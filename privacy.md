# Codegen Privacy Policy

This page contains information on how your data is stored, shared, or used. "You" is the user. "The app" is the Codegen app.

We do not store or share your information, period. This can verified in the open-source code provided in this repository. Google Apps Scripts provide logs for failed executions, but these logs do not contain user information. Here is how each authorization is used:

- openID: This is used to authenticate that you are the owner of your form.
- https://www.googleapis.com/auth/userinfo.email: This is used to contact you when the app requires re-authorization to work.
- https://www.googleapis.com/auth/userinfo.profile: This is used in the re-authorization email sent to you.
- https://www.googleapis.com/auth/forms.currentonly: This is used to access only the form that the Form Code plugin is installed on. This is needed to (a) read the respondent’s email address, (b) determine whether or not the user passed the quiz, and (c) finally email the respondent with a generated code if the respondent passed.
- https://www.googleapis.com/auth/script.storage: This is used to install the plugin on your form.

**Data Access**: The app accesses only a) the form that the Form Code plugin is installed on and b) your email address to use as the reply-to, in the quiz results email.

**Data Usage**: This is needed to (a) read the respondent’s email address, (b) determine whether or not the user passed the quiz, and (c) finally email the respondent with a generated code if the respondent passed.

**Data Storage**: The app does not store your information on a server, anywhere.

**Data Shared**: Data is not shared with third parties, beyond the Google Forms API. The app's use of information received from Google APIs additionally adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes), including the Limited Use requirements.