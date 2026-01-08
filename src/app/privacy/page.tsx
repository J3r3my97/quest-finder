import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Quest-Finder",
};

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
        <p className="text-muted-foreground">
          Last updated: January 2025
        </p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Information We Collect</h2>
          <p>We collect information you provide directly to us:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account Information:</strong> Email address, name, and password when you create an account</li>
            <li><strong>Company Profile:</strong> Business name, NAICS codes, certifications, and preferences you provide to improve contract matching</li>
            <li><strong>Usage Data:</strong> Information about how you interact with our Service, including searches and saved preferences</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide, maintain, and improve the Service</li>
            <li>Match you with relevant government contract opportunities</li>
            <li>Send you alerts about new contracts that match your profile</li>
            <li>Respond to your comments, questions, and support requests</li>
            <li>Send you technical notices and security alerts</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Information Sharing</h2>
          <p>
            We do not sell, trade, or otherwise transfer your personal information to third parties. We may share your information only in the following circumstances:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>With service providers who assist in operating our Service (e.g., email delivery)</li>
            <li>If required by law or to protect our rights</li>
            <li>In connection with a merger, acquisition, or sale of assets</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure. We encourage you to use a strong password and keep your login credentials confidential.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to maintain your session, remember your preferences, and analyze how our Service is used. You can control cookies through your browser settings.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access and receive a copy of your personal data</li>
            <li>Update or correct your information</li>
            <li>Delete your account and associated data</li>
            <li>Opt out of marketing communications</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">7. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active or as needed to provide you services. You may request deletion of your account at any time by contacting us.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">9. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at privacy@quests.aurafarmer.co.
          </p>
        </section>
      </div>
    </div>
  );
}
