import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Link>
        </Button>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            Effective Date: January 7, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground">
              Welcome to ZoPro FSM ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our field service management application.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground mb-4">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Account information (name, email address, phone number)</li>
              <li>Company information (business name, address, contact details)</li>
              <li>Customer data you manage through our platform</li>
              <li>Job, quote, and invoice information</li>
              <li>Photos and documents uploaded to the platform</li>
              <li>Time tracking and scheduling data</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Google OAuth Data Usage</h2>
            <p className="text-muted-foreground mb-4">
              When you sign in using Google OAuth, we access the following information from your Google account:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Email address:</strong> Used to create and identify your account</li>
              <li><strong>Name:</strong> Used for your profile display name</li>
              <li><strong>Profile picture:</strong> Used for your avatar (optional)</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We do not access, store, or share any other data from your Google account. We do not access your Google contacts, calendar, files, or any other Google services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent security incidents</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Data Storage and Security</h2>
            <p className="text-muted-foreground">
              Your data is stored securely using industry-standard encryption and security practices. We use Supabase as our backend infrastructure, which provides enterprise-grade security including encryption at rest and in transit, regular security audits, and compliance with industry standards.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Third-Party Services</h2>
            <p className="text-muted-foreground mb-4">We may share your information with third-party service providers that perform services on our behalf:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Supabase:</strong> Database and authentication services</li>
              <li><strong>Stripe:</strong> Payment processing (if you use payment features)</li>
              <li><strong>Resend:</strong> Email delivery services</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and associated data</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your personal information for as long as your account is active or as needed to provide you services. We will delete or anonymize your information upon request, unless we are required to retain it for legal purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Effective Date" above.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Email:</strong> privacy@zopro.app
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
