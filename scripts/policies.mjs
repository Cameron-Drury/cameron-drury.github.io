const email =
  '<a href="mailto:camerondrurytas@gmail.com">camerondrurytas@gmail.com</a>';
const applePrivacy =
  '<a href="https://www.apple.com/legal/privacy/">Apple’s privacy policy</a>';
const googlePrivacy =
  '<a href="https://policies.google.com/privacy">Google’s privacy policy</a>';
const backupHelp =
  '<a href="https://support.apple.com/en-au/108922">Apple’s backup and storage controls</a>';

const correspondence = {
  title: "When you contact us",
  body: `<p>If you email Drury Module, we receive your email address and any name, message, screenshots or other details you choose to send. We use this information to answer your request, investigate reported problems and keep track of the conversation.</p><p>Our support inbox uses Gmail, so email is also handled by Google under ${googlePrivacy}. Please avoid sending passwords, payment card details or other information we do not need. Support correspondence may be retained while it is needed to resolve your request, handle follow-up questions or meet legal obligations. You can contact us to request access, correction or deletion of information you have sent.</p>`,
};

const contact = {
  title: "Questions and changes",
  body: `<p>For privacy questions or requests, contact Drury Module at ${email}. Please name the app or website page your request concerns. We may need enough information to identify the relevant correspondence before acting on a request.</p><p>We will update this page if our practices change and revise the date shown above. Third-party services manage their own privacy policies and settings.</p>`,
};

export const policies = {
  "game-central": {
    intro:
      "This policy explains how Drury Module handles information in Game Central and when you contact us about the app.",
    sections: [
      {
        title: "Your games stay on your device",
        body: "<p>Game Central does not require a Drury Module account. Game progress, saved worlds, preferences and favourites are stored locally on your device so you can continue playing. The app does not send your gameplay data to Drury Module.</p><p>Game Central has no advertising or analytics SDK and does not include in-app purchases. It does not provide a Drury Module cloud-save or cross-device account service.</p>",
      },
      {
        title: "Apple services and backups",
        body: `<p>Your device may include app data in iCloud or computer backups, depending on your settings. Apple may also handle App Store and device diagnostic information under your Apple settings and ${applePrivacy}. These operating-system services are separate from Game Central’s local save system.</p>`,
      },
      {
        title: "Deleting local data",
        body: `<p>Deleting Game Central from your device removes its local app data, including saved progress. Offloading an app can preserve its data. A separate device backup may still contain a copy; you can manage that through ${backupHelp} or your computer’s backup settings.</p><p>We do not hold a server copy of your saves and cannot recover a deleted local save for you. Contact support before deleting the app if you are trying to fix a problem and want to keep your progress.</p>`,
      },
      correspondence,
      {
        title: "Children and personal information",
        body: "<p>Game Central does not ask players to submit a name, email address or other contact information to play. Parents and guardians can contact us on a child’s behalf. If you believe a child has sent us personal information through support, contact us so we can review the message and handle any deletion request.</p>",
      },
      contact,
    ],
  },
  "idle-ant-colony": {
    intro:
      "This policy explains how Drury Module handles information in Idle Ant Colony, including local saves, advertising, purchases and support.",
    sections: [
      {
        title: "Colony progress and preferences",
        body: "<p>Idle Ant Colony does not require a Drury Module account. Your colony name, progress, upgrades, achievements, gem balance and preferences are stored locally on your device. The app also stores purchase entitlement information and advertising reward timers locally.</p><p>Drury Module does not operate a cloud-save server for your colony or provide account-based progress syncing between devices. Core gameplay can be played offline. Advertisements, purchases and purchase restoration need an internet connection.</p>",
      },
      {
        title: "Advertising through Google AdMob",
        body: `<p>Idle Ant Colony uses Google AdMob to show advertisements, including rewarded videos. The Google Mobile Ads SDK may collect information such as your IP address, approximate location, device or advertising identifiers, diagnostic and performance information, advertisements shown and interactions with ads. Google uses this information to provide and measure advertising, improve its services and help prevent abuse.</p><p>The information processed can depend on your device permissions, settings and the services in use. See ${googlePrivacy} and <a href="https://developers.google.com/admob/ios/privacy/data-disclosure">Google’s Mobile Ads data disclosure</a> for details. You can review the privacy and tracking controls available in your device settings. Restricting tracking does not stop all information needed to serve an ad from being processed.</p><p>The app offers a Remove Ads purchase. Choosing optional advertising features, such as a rewarded video, may still involve Google’s advertising services.</p>`,
      },
      {
        title: "Purchases and Apple",
        body: `<p>Optional gem packs and Remove Ads are processed by Apple through the App Store. The app receives transaction and entitlement information so it can deliver purchases and recognise an eligible restored purchase. Drury Module does not receive your payment card details.</p><p>Apple handles payment records under ${applePrivacy}. Refund requests are handled through Apple; see <a href="https://support.apple.com/en-au/118223">Apple’s refund instructions</a>. Restoring an eligible purchase does not restore your colony save or spent consumable gems.</p>`,
      },
      {
        title: "Notifications",
        body: "<p>If you allow notifications, the app can schedule local reminders about your colony, such as idle earnings or progress. Notification preferences are stored on your device. You can change the app’s reminder options or disable notifications in your device settings.</p>",
      },
      {
        title: "Deleting data and managing backups",
        body: `<p>Deleting Idle Ant Colony removes the app’s local data from your device. Offloading an app can retain its data. In-game reset options reset colony progress and may preserve separate items such as your gem balance or purchase entitlements.</p><p>Depending on your settings, Apple or a computer backup may hold a copy of local app data. Manage these copies through ${backupHelp} or your computer’s backup settings. Deleting local app data does not delete records held separately by Apple or Google; their policies describe the controls available for their services.</p><p>We cannot recover a colony from a Drury Module server. If you are troubleshooting, contact support before resetting or deleting the app.</p>`,
      },
      correspondence,
      {
        title: "Children and family privacy",
        body: "<p>Playing does not require a child to send contact details to Drury Module. Parents and guardians should review advertising, purchasing and privacy controls on the device. The advertising services described above can process device and usage information.</p><p>If you believe a child has sent us personal information through support, contact us so we can review it and handle any deletion request. Please have a parent or guardian contact support where appropriate.</p>",
      },
      contact,
    ],
  },
  website: {
    intro:
      "This policy covers the Drury Module company, game and support pages on this website. Each app has its own privacy policy describing what happens inside the app.",
    sections: [
      {
        title: "Browsing these pages",
        body: "<p>We do not add analytics, advertising trackers or cookies to these company, game and support pages. Their fonts, artwork and other page assets are served with the site. You do not need to create an account to browse.</p>",
      },
      {
        title: "Hosting",
        body: '<p>This site is hosted on GitHub Pages. When your browser requests a page or file, GitHub receives technical information needed to deliver and protect the service, such as your IP address and request information. GitHub may retain technical logs under its own practices. Read the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub privacy statement</a> for details.</p>',
      },
      {
        title: "The support email builder",
        body: "<p>The support email builder prepares a message in your email app. It does not submit your details to a website server. We receive the message only if you send it through your email service. You can review and edit the draft before sending it.</p>",
      },
      correspondence,
      {
        title: "Links to other services",
        body: `<p>Links to the App Store, GitHub, Apple support and other external services take you to sites operated by those providers. Their own privacy policies apply when you visit them. Apple’s practices are described in ${applePrivacy}.</p>`,
      },
      {
        title: "Your choices",
        body: `<p>You can browse without sending us a message. If you contact us, share only the details needed for your request. To ask about information held in our support correspondence, including a request to correct or delete it, email ${email}. Parents and guardians may contact us about information a child has sent.</p>`,
      },
      contact,
    ],
  },
};
