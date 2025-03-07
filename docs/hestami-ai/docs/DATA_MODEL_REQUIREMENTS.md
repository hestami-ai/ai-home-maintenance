1. Data Collection and Storage

ANSWER:As we are developing an MVP (minimum viable product) we are focused really developing a strong but focused end to end proof of concept and proof of value. This system initially will be deployed locally on a single server using containers such as Docker files and Docker Compose.

The data volumes will be low initially but may grow if there is enough market interest. Simple filesystem storage on the server will suffice for the time being.

    Image and Video Data:
        Storage Requirements:
            How will images and videos captured by 3D cameras and drones be stored?
                Will they be stored directly in your database, or will you use a cloud storage service like AWS S3 or Azure Blob Storage?

             ANSWER: A local server will be used for testing and development and deployment that has sufficient storage capacity for nearterm storage needs.

            Do you need to store metadata such as timestamps, geolocation, equipment used, or other relevant details?
            ANSWER: Yes, we need to store metadata such as timestamps, geolocation, equipment used, or other relevant details. 
        Data Volume:
            What is the expected volume and size of these media files?
            Are there any retention policies for how long this data should be kept?

            ANSWER: The local server is configured with enough storage capacity to handle the expected volume and size of media files. The data will be stored for as long as it is needed for analysis and presentation purposes which for the time being will be into perpetuity.

    AI Analysis Results:
        Data Points:
            What specific data will the AI algorithms produce? (e.g., maintenance issues identified, severity levels, recommended actions)

            ANSWER: For the time being the AI algorithms will not produce any specific data points for this MVP scope. The system will be focused on proof of concept and proof of value which is defined by developing the base system to register homeowners and service providers, submit bids, and receive bids and allow hestami ai staff to conduct research manually until we are able to implement the AI Agents in the latter phase of the MVP scope.

        Historical Data:
            Do you need to keep a history of all analyses over time to track changes or progress?

            ANSWER: For the MVP scope, there will be no analyses to keep track of.

2. Project Lifecycle Management

    Bid Solicitation:
        Process Flow:
            How are bids solicited from service providers?
                Do service providers receive automated notifications?
                Can service providers submit bids through your platform?

            ANSWER: The AI agent takes the information provided by the homeowner/property owner and after determining it has sufficient information to process the request for bids, the AI agent will run internet search queries over places like Google Search, Yelp, Bing Search, Thumbtack, etc. to identify businesses and service providers. Then the AI Agent will reach out to some yet to be determined number of them to request that they provide bids if they are interested. They may submit responses through their platform on choice. The AI agent will retrieve that information whether through email, text, or the platform (e.g., through Thumbtack or Yelp). Alternatively they may use this platform - Hestami AI - to respond as well. Either way, the system will need to keep track of those various methods of bid communications.


        Bid Evaluation:
            How will bids be evaluated and recommended to homeowners?
            Will AI agents perform the evaluation based on predefined criteria?

            ANSWER: The homeowner will be able to specify one of three priorities: price, reputation (via online reviews), or urgency. Additionally, the system will display an "underdog" who may not have a lot of reviews but perhaps is worth the risk depending on the bid requirements (i.e., reputation) who may not have a online review presence but is offering a great price and can demonstrate other value through pictures of their prior work or client feedback (the latter of which the system might independently confirm through contacting the references). The AI Agents will just present the summary findings and allow the homeowner to make their choice based on the materials presented.

        Data Requirements:
            Do we need to model entities for bid requests, bids, and evaluations?
            What data fields are necessary for each bid (e.g., price, estimated time, provider ratings)?

            ANSWER: Yes you need to model entities for bid requests, bids, and evaluations. No basic data requirements have been documented for bid management process. Your best recommendation for an MVP system is desired.


    Communication with Service Providers:
        AI Agents Interaction:
            How will AI agents conduct internet searches or make phone calls?
            Do we need to store logs, transcripts, or summaries of these interactions?
        Third-Party Integration:
            Will the system integrate with external platforms (e.g., service provider directories)?

        ANSWER: A subsystem will need to be developed (i.e., is a part of MVP system requirements but for a late phase; primary scope will be basic account management to allow homeowners / property owners to register and authenticate, ditto for business owners / service providers and register their list of services provided and finally to allow Hestami AI staff to review bids across all homeowners and manually conduct research until the AI Agents are able to do so.). AI Agents will use google search, bing search, etc via tools like Skyvern (see description below) and navigate provider websites whether through a platform such as Thumbtack or their individual provider websites and contact them through online forms, emails, or phone calls, text message, etc. All AI Agent activities should be logged and recorded.

        ========
        Skyvern was inspired by the Task-Driven autonomous agent design popularized by BabyAGI and AutoGPT -- with one major bonus: we give Skyvern the ability to interact with websites using browser automation libraries like Playwright.

        Skyvern uses a swarm of agents to comprehend a website, and plan and execute its actions:

        Interactable Element Agent: This agent is responsible for parsing the HTML of a website and extracting the interactable elements.
        Navigation Agent: This agent is responsible for planning the navigation to complete a task. Examples include clicking buttons, inserting text, selecting options, etc.
        Data Extraction Agent: This agent is responsible for extracting data from a website. It's capable of reading the tables and text on the page, and extracting the output in a user-defined structured format
        Password Agent: This agent is responsible for filling out password forms on a website. It's capable of reading the username and password from a password manager, and filling out the form while preserving the privacy of the user-defined secrets.
        2FA Agent: This agent is responsible for filling out 2FA forms on a website. It's capable of intercepting website requests for 2FAs, and either requesting user-defined APIs for 2FA codes or waiting for users to feed 2FA codes into it, and then completing the login process.
        Dynamic Auto-complete Agent: This agent is responsible for filling out dynamic auto-complete forms on a website. It's capable of reading the options presented to it, selecting the appropriate option based on the user's input, and adjusting its inputs based on the feedback from inside the form. Popular examples include: Address forms, university dropdowns, and more.

        ========

3. Payment Processing

    Payment Workflow:
        Process Details:
            Will payments be handled entirely through your platform?
            Are partial payments, deposits, or payment milestones part of the process?

            ANSWER: The payment process has not been fully envisioned at this time. However, it is expected that some payment transfer processing will be necessary to allow homeowners to pay for services and to allow service providers to receive payments. E.g., a homeowner / property owner will pay Hestami AI so that a service charge can be added to their account and a service provider will receive payment from their customer through our payment processor.

        Payment Processor Integration:
            Which payment processors will you integrate with (e.g., Stripe, PayPal)?
            Do we need to store payment methods securely (considering PCI DSS compliance)?

            ANSWER: Payment processor integration will be a later phase of MVP development. At this time, we are focused on proof of concept and proof of value.

        Refunds and Disputes:
            How will refunds or disputes be handled?
            Do we need to model these scenarios in the data model?

            ANSWER: Refunds and disputes will be a later phase of MVP development. At this time, we are focused on proof of concept and proof of value.

4. Homeowner Associations (HOAs)

    HOA Interaction:
        Approval Process:
            How is the HOA approval process initiated and tracked?
            Will HOAs have user accounts on the platform?

            ANSWER: The HOA approval process is a later phase of MVP development. At this time, we are focused on proof of concept and proof of value. However, we expect email to be the primary means of communication between hestami AI agents and staff and homeowners and HOAs and service providers. The system will probably generate PDFs for the HOAs to review and approve / disapprove requests.

        Data Modeling:
            Do we need to model HOAs as entities with their own set of users and permissions?
            Are there specific documents or forms that need to be stored and associated with projects?

            ANSWER: The HOA approval process is a later phase of MVP development. At this time, we are focused on proof of concept and proof of value.

        Communication:
            How will communication between homeowners, HOAs, and service providers be managed?
            Do we need a messaging system or notification service?

            ANSWER: The HOA approval process is a later phase of MVP development. At this time, we are focused on proof of concept and proof of value.

5. User Roles and Permissions

    Additional Roles:
        HOA Representatives:
            Will HOA representatives need access to the system to approve projects?

            ANSWER: HOA representatives will not need access to the system. They will provide their approval for projects likely through email (TBD). The HOA approval process is a later phase of MVP development. At this time, we are focused on proof of concept and proof of value.
        AI Agents:
            How are AI agents represented in the system?
            Do they require modeling as entities, or are they services running in the background?

            ANSWER: The AI agents will be represented as a specific type of user and role in the system (e.g., bid manager, business researcher, etc.). However, these specific roles will be defined later in the development process. At this time, we are focused on proof of concept and proof of value.

    Permission Levels:
        Granular Access Control:
            Do different users within the same role need different permissions?
            Should we implement a role-based access control (RBAC) or attribute-based access control (ABAC) system?

            ANSWER: There needs to be basic permissions and RBAC in the system. For the initial MVP there are privileges that are relevant to homeowners, to service providers and to hestami staff (humans and AI agents). This is likely to be expanded later in the development process. For the time being, homeowners will need privileges over their own accounts, the media that they post (e.g., images, videos, etc.) and to be able to remove those and grant service provider access as necessary to specific media relevant to their projects and bids. E.g., if there is a bid for a carpet stain cleanup then they should have access to the photos that show the carpet stains in the relevant room. They do not however need access to images of the roof top.

6. Service Providers

    Onboarding Process:
        Registration:
            Do service providers sign up directly on the platform?
            Is there an approval or vetting process before they can receive bids?

            ANSWER: Service providers will need to register with the system as service providers. The registration process will be simple for the time being and based on their existenance in other platforms (e.g., Google Maps, Yelp, Thumbtack, etc.) and their ability to provide services. At this time, we are focused on proof of concept and proof of value. The vetting process will be a later phase of development.

        Credentials and Certifications:
            Do we need to store documents like licenses, insurance certificates, or other credentials?
            Will these documents require verification?

            ANSWER: At this time, we are focused on proof of concept and proof of value. The vetting process will be a later phase of development.


    Ratings and Reviews:
        Feedback Mechanism:
            Can homeowners rate or review service providers?
            Do we need to store and display this information?

            ANSWER: Yes, homeowners will be able to rate and review service providers.

7. Data Privacy and Compliance

    Sensitive Data Handling:
        Personal Data:
            What personal data will be collected from users?
            Do we need to implement features for data access and deletion requests under GDPR or CCPA?

            ANSWER: There is no need to implement features for data access and deletion requests under GDPR or CCPA. At this time, we are focused on proof of concept and proof of value. Sensitive data like credit card information and passwords will be encrypted in the database when such information is collected.

        Media Content:
            Are there privacy concerns with storing images and videos of private properties?
            How will consent be managed and documented?

            ANSWER: The terms of service when homeowners register will include a privacy policy and consent acknowledgement. 

    Compliance Requirements:
        Regulations:
            Are there industry-specific regulations that the system must comply with?
            Do we need to consider HIPAA, if health-related issues are ever involved?

            ANSWER: No such regulations have been identified at this time.

8. Communication and Notifications

    Messaging System:
        Internal Messaging:
            Will there be a messaging feature for users to communicate within the platform?
            Should messages be stored, and do we need to consider encryption?

            ANSWER: At this time there will be no internal messaging feature. However, email, text, and phone calls will be used to communicate with homeowners and HOAs and service providers. Those specific services will be provided by third-party providers.

    Notifications:
        Types:
            Email, SMS, or push notifications?
            Do we need to track notification preferences per user?
        Content:
            What kinds of events trigger notifications (e.g., new bid received, HOA approval needed)?

            ANSWER: Notification preferences will need to be tracked per user. However, at this time, we have not determined what specific events will trigger notifications at what level. Certainly the system will need to be able to send notifications to homeowners, HOAs, and service providers and internally to itself as well, as bids are submitted and and replied to, etc. through the workflow.

9. Scheduling and Logistics

    Appointment Management:
        Scheduling Inspections and Repairs:
            How are appointments scheduled between homeowners and service providers?
            Do we need to handle availability calendars for both parties?
        Rescheduling and Cancellations:
            What is the process for changing or canceling appointments?
            Are there any fees or penalties involved?

            ANSWER: Homeowners / property owners will specify their preferred date and time. Service providers will be able to provide their own availability calendar to homeowners and specify their preferred date and time. Homeowners will be able to select provider based on their net preferences based on bid responses from service providers. 

            As for rescheduling and cancellations, this is a later phase of development. At this time, we are focused on proof of concept and proof of value.

10. AI Model Integration

    AI Algorithm Outputs:
        Data Storage:
            Do we need to store AI model outputs, such as maintenance recommendations and risk assessments?

            ANSWER: All AI agent model outputs will be stored in the database for future analysis.

        Model Training Data:
            Will user data be used to train or improve AI models?
            How will you handle user consent for this?

            ANSWER: User data may be used to train or improve AI models. Consent of users is TBD. This is mostly a future phase of development concern post-MVP.

    Versioning and Updates:
        Model Management:
            Do we need to track different versions of AI models?
            How are updates deployed and managed?

            ANSWER: Model updates will be a later phase of development. At this time, we are focused on proof of concept and proof of value.

11. Reporting and Analytics

    User Dashboards:
        Homeowners:
            Do homeowners get reports on property health, maintenance schedules, or cost estimates?

            ANSWER: Yes, homeowners will get reports on property health, maintenance schedules, or cost estimates.
        Service Providers:
            Do service providers have access to analytics about their bids, acceptance rates, or customer feedback?

            ANSWER: Yes, service providers will have access to analytics about their bids, acceptance rates, or customer feedback.

    Administrative Reports:
        Business Metrics:
            What KPIs are important for your business?
            Do we need to model data for revenue tracking, user engagement, or AI performance?

            ANSWER: Business metrics will be a later phase of development. At this time, we are focused on proof of concept and proof of value.

12. Scalability and Performance

    Data Volume Expectations:
        Media Storage:
            Given the use of high-resolution images and videos, do we need to plan for large-scale storage solutions?

            ANSWER: There is no need to plan for large-scale storage solutions. At this time, we are focused on proof of concept and proof of value.

    Performance Requirements:
        Response Times:
            Are there specific performance targets for data retrieval and AI analysis?

            ANSWER: At this time, we are focused on proof of concept and proof of value and as such we do not have specific performance targets for data retrieval and AI analysis.

        Concurrent Users:
            What is the expected number of concurrent users?

            ANSWER: Concurrent users is expected to be low in the beginning. However, the system will be designed to scale as needed.

13. Third-Party Integrations

    External APIs:
        Mapping and Location Services:
            Will you integrate with services like Google Maps for location data?

            ANSWER: Location data is not a priority at this time.

        Communication Services:
            Are you using services like Twilio for SMS or phone call automation?

            ANSWER: Yes, Twilio is a candidate for SMS and phone call automation.

    Authentication Providers:
        Social Logins:
            Will users be able to sign up or log in using third-party services like Google or Facebook?

            ANSWER: Yes, users will be able to sign up or log in using third-party services like Google or Facebook.

14. Legal and Compliance Documents

    Contracts and Agreements:
        Digital Signatures:
            Do contracts between homeowners and service providers need to be signed electronically?

            ANSWER: Yes, contracts between homeowners and service providers will need to be signed electronically. However, that may be provided by a third-party service provider.

        Document Storage:
            Do we need to store copies of agreements, terms of service acknowledgments, or other legal documents?

            ANSWER: Yes, we will need to store copies of agreements, terms of service acknowledgments, or other legal documents.

    Policy Management:
        Versioning:
            How will changes to terms of service or privacy policies be managed and communicated?

            ANSWER: Policy changes will be a later phase of development. At this time, we are focused on proof of concept and proof of value.

15. Internationalization and Localization

    Multiple Languages:
        Language Support:
            Do you plan to support multiple languages?
        Date and Currency Formats:
            Will the system need to handle different regional settings?

    ANSWER: Internationalization and localization will be a later phase of development. At this time, we are focused on proof of concept and proof of value.

16. User Experience Considerations

    Mobile Access:
        Responsive Design:
            Will the web application be optimized for mobile devices?
        Native Apps:
            Are there plans for native iOS or Android applications?
    ANSWER: Mobile access is a key priority for the MVP as photo and video uploads are a key feature. There is a need to leverage iOS specifically to leverage RoomPlan functionality for generating floor plans. Android reportedly has an ARCore capability that can be leveraged to generate floor plans. However, this is a later phase of development. At this time, we are focused on proof of concept and proof of value.

17. Disaster Recovery and Data Backups

    Backup Strategy:
        Data Loss Prevention:
            What are the requirements for data backups and recovery?
        Uptime Requirements:
            Are there Service Level Agreements (SLAs) for system availability?

    ANSWER: Disaster recovery and data backups will be a later phase of development. At this time, we are focused on proof of concept and proof of value.

18. Security Measures

    Authentication and Authorization:
        Multi-Factor Authentication:
            Is MFA required for any user roles?
        ANSWER: MFA will be a later phase of development. At this time, we are focused on proof of concept and proof of value.

    Data Encryption:
        At Rest and In Transit:
            Do we need to encrypt data stored in the database?
            Are there specific encryption standards to follow?
        ANSWER: TLS for data in transit is implemented and terminated at the edge of the network. Data at rest for the database should be encrypted for sensitive data.

    Audit Trails:
        Activity Logging:
            Do we need to log user activities for security audits?
        ANSWER: Activity logging will be important to track user actions in terms of the data that they are uploading, deleting, etc.

