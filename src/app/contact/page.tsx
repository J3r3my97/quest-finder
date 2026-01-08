import { Metadata } from "next";
import { Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the Quest-Finder team",
};

export default function ContactPage() {
  return (
    <div className="container max-w-2xl py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">Contact Us</h1>
        <p className="text-muted-foreground">
          Have questions or feedback? We&apos;d love to hear from you.
        </p>
      </div>

      <div className="rounded-lg border p-8 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
          <Mail className="h-8 w-8 text-primary" />
        </div>

        <h2 className="text-xl font-semibold mb-2">Email Us</h2>
        <p className="text-muted-foreground mb-4">
          For support, questions, or partnership inquiries:
        </p>

        <a
          href="mailto:support@quests.aurafarmer.co"
          className="text-lg font-medium text-primary hover:underline"
        >
          support@quests.aurafarmer.co
        </a>

        <p className="text-sm text-muted-foreground mt-6">
          We typically respond within 24 hours.
        </p>
      </div>
    </div>
  );
}
