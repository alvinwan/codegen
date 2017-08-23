/**
 * @OnlyCurrentDoc
 *
 * The above comment directs Apps Script to limit the scope of file
 * access for this add-on. It specifies that this add-on will only
 * attempt to read or modify the files in which the add-on is used,
 * and not all of the user's files. The authorization request message
 * presented to users will reflect this limited scope.
 */

/**
 * A global constant String holding the title of the add-on. This is
 * used to identify the add-on in the notification emails.
 */
var ADDON_TITLE = 'Form Code Generator';

/**
 * A global constant 'notice' text to include with each email
 * notification.
 */
var NOTICE = "Form Code Generator was created for lightweight use cases only. \
It should not be used for complex or important workflows, as the security of \
these hash codes are not generated per state-of-the-art standards \
(e.g., does not support nonce values). ";


/**
 * Adds a custom menu to the active form to show the add-on sidebar.
 *
 * @param {object} e The event parameter for a simple onOpen trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode.
 */
function onOpen(e) {
  FormApp.getUi()
      .createAddonMenu()
      .addItem('Configure generator', 'showSidebar')
      .addItem('About', 'showAbout')
      .addToUi();
}

/**
 * Runs when the add-on is installed.
 *
 * @param {object} e The event parameter for a simple onInstall trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode. (In practice, onInstall triggers always
 *     run in AuthMode.FULL, but onOpen triggers may be AuthMode.LIMITED or
 *     AuthMode.NONE).
 */
function onInstall(e) {
  onOpen();
}

/**
 * Opens a sidebar in the form containing the add-on's user interface for
 * configuring the notifications this add-on will produce.
 */
function showSidebar() {
  var ui = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setTitle('Form Code Generator');
  FormApp.getUi().showSidebar(ui);
}

/**
 * Opens a purely-informational dialog in the form explaining details about
 * this add-on.
 */
function showAbout() {
  var ui = HtmlService.createHtmlOutputFromFile('About')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setWidth(420)
      .setHeight(270);
  FormApp.getUi().showModalDialog(ui, 'About Form Code Generator');
}

/**
 * Save sidebar settings to this form's Properties, and update the onFormSubmit
 * trigger as needed.
 *
 * @param {Object} settings An Object containing key-value
 *      pairs to store.
 */
function saveSettings(settings) {
  PropertiesService.getDocumentProperties().setProperties(settings);
  adjustFormSubmitTrigger();
}

/**
 * Convert the current form into a quiz.
 */

function convertToQuiz() {
  var form = FormApp.getActiveForm();

  if (form.isQuiz()) {
    return 'Nice! Already a quiz.';
  } else {
    form.setIsQuiz(true);
    return 'Converted to quiz.';
  }
}

/**
 * Queries the User Properties and adds additional data required to populate
 * the sidebar UI elements.
 *
 * @return {Object} A collection of Property values and
 *     related data used to fill the configuration sidebar.
 */
function getSettings() {
  var settings = PropertiesService.getDocumentProperties().getProperties();

  // Use a default code salt if the salt hasn't been provided yet.
  if (!settings.codeSalt) {
    settings.codeSalt = Session.getEffectiveUser().getEmail();
  }

  if (!settings.emailMeAddress) {
    settings.emailMeAddress = Session.getEffectiveUser().getEmail();
  }

  // Get text field items in the form and compile a list
  //   of their titles and IDs.
  var form = FormApp.getActiveForm();
  var textItems = form.getItems(FormApp.ItemType.TEXT);
  settings.textItems = [];
  for (var i = 0; i < textItems.length; i++) {
    settings.textItems.push({
      title: textItems[i].getTitle(),
      id: textItems[i].getId()
    });
  }
  return settings;
}

/**
 * Adjust the onFormSubmit trigger based on user's requests.
 */
function adjustFormSubmitTrigger() {
  var form = FormApp.getActiveForm();
  var triggers = ScriptApp.getUserTriggers(form);
  var settings = PropertiesService.getDocumentProperties();
  var triggerNeeded = true;

  // Create a new trigger if required; delete existing trigger
  //   if it is not needed.
  var existingTrigger = null;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getEventType() == ScriptApp.EventType.ON_FORM_SUBMIT) {
      existingTrigger = triggers[i];
      break;
    }
  }
  if (triggerNeeded && !existingTrigger) {
    var trigger = ScriptApp.newTrigger('respondToFormSubmit')
        .forForm(form)
        .onFormSubmit()
        .create();
  } else if (!triggerNeeded && existingTrigger) {
    ScriptApp.deleteTrigger(existingTrigger);
  }
}

/**
 * Responds to a form submission event if an onFormSubmit trigger has been
 * enabled.
 *
 * @param {Object} e The event parameter created by a form
 *      submission; see
 *      https://developers.google.com/apps-script/understanding_events
 */
function respondToFormSubmit(e) {
  var form = FormApp.getActiveForm();
  var settings = PropertiesService.getDocumentProperties();
  var authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);

  // Check if the actions of the trigger require authorizations that have not
  // been supplied yet -- if so, warn the active user via email (if possible).
  // This check is required when using triggers with add-ons to maintain
  // functional triggers.
  if (authInfo.getAuthorizationStatus() ==
      ScriptApp.AuthorizationStatus.REQUIRED) {
    // Re-authorization is required. In this case, the user needs to be alerted
    // that they need to reauthorize; the normal trigger action is not
    // conducted, since authorization needs to be provided first. Send at
    // most one 'Authorization Required' email a day, to avoid spamming users
    // of the add-on.
    sendReauthorizationRequest();
  } else {
    // All required authorizations have been granted, so continue to respond to
    // the trigger event.

    var code = '';
    var message = '';
    var passed = false;
    var respondentEmail = getRespondentEmail(e.response);

    // Generate a code if need be, and notify the respondent.
    if (settings.getProperty('quizScore') != 'true') {
      code = generateCode(e.response);
      message = 'Thank you for submitting! (Tester: ' + respondentEmail + ') Here is your code.';
      passed = true;
    } else {
      var percentage = evaluatePercentage(e.response);
      var requiredPercentage = parseFloat(settings.getProperty('requiredScore'));
      if (percentage >= requiredPercentage) {
        code = generateCode(e.response);
        message = 'Congratulations! (Tester: ' + respondentEmail + ') You received ' + percentage + '% and needed ' + requiredPercentage + '%. Here is your code.';
        passed = true;
      } else {
        message = 'Ack. :( You received ' + percentage + '% but needed ' + requiredPercentage + '% . Please try again.';
      }
    }

    // Check if the form respondent needs to be notified; if so, construct and
    // send the notification. Be sure to respect the remaining email quota.
    if (MailApp.getRemainingDailyQuota() > 0) {
      sendNotification(respondentEmail, code, message);
    }

    // Check if the form creator needs to be notified.
    if (MailApp.getRemainingDailyQuota() > 0 && settings.getProperty('emailMe') === 'true' && passed) {
      var emailAddress = settings.getProperty('emailMeAddress');
      if (!emailAddress) {
        emailAddress = Session.getActiveUser().getEmail();
      }
      Logger.log('Sending email to' + emailAddress);
      sendNotification(emailAddress, code, message);
    }
  }
}

/**
 * Generate code for a successfully completed response.
 *
 * @param {FormResponse} response FormResponse object of the event
 *      that triggered this notification
 */
function generateCode(response) {
  var settings = PropertiesService.getDocumentProperties();
  var respondentEmail = getRespondentEmail(response);
  var salt = settings.getProperty('codeSalt');
  return MD5(respondentEmail + salt + 'dEstr0yR@1nB0wTAb1es');
}

/**
 * MD5 hash function
 * https://stackoverflow.com/a/11868113/4855984
 *
 * @param {string} input The text to hash using md5
 */
function MD5 (input) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
  var txtHash = '';
  for (i = 0; i < rawHash.length; i++) {
    var hashVal = rawHash[i];
    if (hashVal < 0) {
      hashVal += 256;
    }
    if (hashVal.toString(16).length == 1) {
      txtHash += '0';
    }
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

/**
 * Compute score for provided quiz.
 *
 * @param {FormResponse} response FormResponse object of the event
 *      that triggered this notification
 */
function evaluatePercentage(response) {
  var totalScore = 0;
  var maximumScore = 0;
  var responseItems = response.getGradableItemResponses();
  for (var i = 0; i < responseItems.length; i++) {
    var itemResponse = responseItems[i];
    var responseScore = itemResponse.getScore();
    var itemMaximumScore = toItem(itemResponse.getItem()).getPoints();
    totalScore += responseScore;
    maximumScore += itemMaximumScore;
    Logger.log('Response #%s to the question "%s" was "%s" (Score: %s/%s)',
               (i + 1).toString(),
               itemResponse.getItem().getTitle(),
               itemResponse.getResponse(),
               responseScore,
               itemMaximumScore);
  }
  if (maximumScore == 0) {
    return 0;
  }
  return totalScore / maximumScore * 100;
}

/**
 * Extract point value for question.
 *
 * @param {Item} item The item associated with a form response.
 */
function toItem(item) {
  if (item.getType() == FormApp.ItemType.CHECKBOX) {
    return item.asCheckboxItem();
  } else if (item.getType() == FormApp.ItemType.DATE) {
    return item.asDateItem();
  } else if (item.getType() == FormApp.ItemType.DATETIME) {
    return item.asDateTimeItem();
  } else if (item.getType() == FormApp.ItemType.DURATION) {
    return item.asDurationItem();
  } else if (item.getType() == FormApp.ItemType.LIST) {
    return item.asListItem();
  } else if (item.getType() == FormApp.ItemType.MULTIPLE_CHOICE) {
    return item.asMultipleChoiceItem();
  } else if (item.getType() == FormApp.ItemType.PARAGRAPH_TEXT) {
    return item.asParagraphTextItem();
  } else if (item.getType() == FormApp.ItemType.SCALE) {
    return item.asScaleItem();
  } else if (item.getType() == FormApp.ItemType.TEXT) {
    return item.asTextItem();
  } else if (item.getType() == FormApp.ItemType.TIME) {
    return item.asTimeItem();
  // end gradable items
  } else if (item.getType() == FormApp.ItemType.GRID) {
    return item.asGridItem();
  } else if (item.getType() == FormApp.ItemType.IMAGE) {
    return item.asImageItem();
  } else if (item.getType() == FormApp.ItemType.PAGE_BREAK) {
    return item.asPageBreakItem();
  } else if (item.getType() == FormApp.ItemType.SECTION_HEADER) {
    return item.asSectionHeaderItem();
  } else if (item.getType() == FormApp.ItemType.VIDEO) {
    return item.asVideoItem();
  } else {
    Logger.log('Impossibility! Found an item that doesn\'t exist');
  }
}


/**
 * Called when the user needs to reauthorize. Sends the user of the
 * add-on an email explaining the need to reauthorize and provides
 * a link for the user to do so. Capped to send at most one email
 * a day to prevent spamming the users of the add-on.
 */
function sendReauthorizationRequest() {
  var settings = PropertiesService.getDocumentProperties();
  var authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  var lastAuthEmailDate = settings.getProperty('lastAuthEmailDate');
  var today = new Date().toDateString();
  if (lastAuthEmailDate != today) {
    if (MailApp.getRemainingDailyQuota() > 0) {
      var template =
          HtmlService.createTemplateFromFile('AuthorizationEmail');
      template.url = authInfo.getAuthorizationUrl();
      template.notice = NOTICE;
      var message = template.evaluate();
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
          'Authorization Required',
          message.getContent(), {
            name: ADDON_TITLE,
            htmlBody: message.getContent()
          });
    }
    settings.setProperty('lastAuthEmailDate', today);
  }
}

/**
 * Get email item from current form.
 */
function getEmailItem() {
  var form = FormApp.getActiveForm();
  var settings = PropertiesService.getDocumentProperties();
  var emailId = settings.getProperty('respondentEmailItemId');
  var emailItem = form.getItemById(parseInt(emailId));
  return emailItem;
}

/**
 * Get respondent email address from form response.
 *
 * @param {FormResponse} response FormResponse object of the event
 *     that triggered this notification
 */
function getRespondentEmail(response) {
  var respondentEmail = response.getResponseForItem(getEmailItem())
      .getResponse();
  return respondentEmail;
}

/**
 * Sends email to the provided email.
 *
 * @param {string} emailAddress The destination
 * @param {string} code Newly generated to send
 * @param {string} message Message placing the code in context
 */
function sendNotification(emailAddress, code, message) {
  var form = FormApp.getActiveForm();
  var settings = PropertiesService.getDocumentProperties();
  if (emailAddress) {
    var template =
        HtmlService.createTemplateFromFile('RespondentNotification');
    template.paragraphs = settings.getProperty('responseText').split('\n');
    template.notice = NOTICE;
    template.message = message;
    template.code = code;
    var message = template.evaluate();
    MailApp.sendEmail(emailAddress,
        settings.getProperty('responseSubject'),
        message.getContent(), {
          name: form.getTitle(),
            htmlBody: message.getContent()
        });
  }
}