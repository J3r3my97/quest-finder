import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Quest-Finder",
};

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
        <p className="text-muted-foreground">
          Last updated: January 2025
        </p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing and using Quest-Finder (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Description of Service</h2>
          <p>
            Quest-Finder is a platform that helps users discover and track government contract opportunities. We aggregate publicly available contract data from sources including SAM.gov, COMMBUYS, and other government procurement platforms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. User Accounts</h2>
          <p>
            To use certain features of the Service, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Data Accuracy</h2>
          <p>
            While we strive to provide accurate and up-to-date contract information, Quest-Finder does not guarantee the accuracy, completeness, or timeliness of the data. Users should verify all contract details directly with the issuing government agency before taking action.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to the Service or its systems</li>
            <li>Interfere with or disrupt the Service</li>
            <li>Scrape or harvest data from the Service without permission</li>
            <li>Resell or redistribute the Service without authorization</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are owned by Quest-Finder and are protected by intellectual property laws. Government contract data is public information and is not claimed as proprietary.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">7. Limitation of Liability</h2>
          <p>
            Quest-Finder shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service, including but not limited to loss of contracts, opportunities, or revenue.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">8. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. We will notify users of significant changes via email or through the Service. Continued use of the Service after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">9. Contact</h2>
          <p>
            If you have questions about these Terms of Service, please contact us at support@quests.aurafarmer.co.
          </p>
        </section>
      </div>
    </div>
  );
}
