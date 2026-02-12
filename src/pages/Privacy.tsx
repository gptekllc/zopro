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
              This Privacy Policy describes how GPTek LLC ("Company," "we," "our," or "us") collects, uses, and protects information in connection with the ZoPro mobile and web application ("ZoPro" or the "Service").
            </p>
            <p className="text-muted-foreground mt-4">
              ZoPro is a field service management application operated by GPTek LLC. By using ZoPro, you agree to the practices described in this Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground mb-4">We collect information you provide directly to us, including:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Account Information:</strong> Name, email address, phone number, login credentials</li>
              <li><strong>Company Information:</strong> Business name, address, and contact details</li>
              <li><strong>Customer Data:</strong> Customer contact details and service information entered into the platform</li>
              <li><strong>Operational Data:</strong> Jobs, quotes, invoices, scheduling data, and time tracking records</li>
              <li><strong>Uploaded Content:</strong> Photos, documents, and files you upload</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We collect only the information necessary to provide and improve the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. SMS Communications</h2>
            <p className="text-muted-foreground mb-4">
              If you provide your phone number and consent to receive SMS communications, ZoPro (operated by GPTek LLC) may send:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>One-time verification codes</li>
              <li>Account notifications and alerts</li>
              <li>Job or schedule confirmations</li>
              <li>Security-related messages</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Message frequency varies. Message and data rates may apply.
            </p>
            <p className="text-muted-foreground mt-2">
              You may opt out at any time by replying <strong>STOP</strong> to any message.
            </p>
            <p className="text-muted-foreground mt-2">
              For assistance, reply <strong>HELP</strong> or contact us at{" "}
              <a href="mailto:privacy@zopro.app" className="text-primary hover:underline">privacy@zopro.app</a>.
            </p>
            <p className="text-muted-foreground mt-4">
              We do not sell, rent, or share your phone number with third parties for their marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Google OAuth Data Usage</h2>
            <p className="text-muted-foreground mb-4">
              If you sign in using Google OAuth, we access only:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Email address</strong> (for account identification)</li>
              <li><strong>Name</strong> (for profile display)</li>
              <li><strong>Profile picture</strong> (optional avatar)</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We do not access your Google contacts, calendar, files, or other Google account data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">We use information to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Provide, operate, and improve ZoPro</li>
              <li>Process transactions and manage billing</li>
              <li>Send service-related communications and security notices</li>
              <li>Provide customer support</li>
              <li>Monitor usage trends and improve system performance</li>
              <li>Detect, prevent, and investigate fraud or security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We do not sell personal information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Third-Party Service Providers</h2>
            <p className="text-muted-foreground mb-4">We use trusted third-party providers to operate the Service:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Supabase</strong> – Database hosting and authentication</li>
              <li><strong>Stripe</strong> – Payment processing (if applicable)</li>
              <li><strong>Resend</strong> – Email delivery</li>
              <li><strong>Twilio</strong> – SMS delivery services</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              These providers process data solely to provide services on our behalf and are required to safeguard information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Data Storage and Security</h2>
            <p className="text-muted-foreground">
              We implement reasonable administrative, technical, and physical safeguards to protect your information. Data is encrypted in transit and, where applicable, at rest.
            </p>
            <p className="text-muted-foreground mt-4">
              No method of transmission over the Internet is 100% secure; however, we take commercially reasonable measures to protect your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain information for as long as your account remains active or as necessary to provide services.
            </p>
            <p className="text-muted-foreground mt-4">
              Upon request, we will delete or anonymize your personal information unless retention is required for legal, tax, or regulatory purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Your Rights</h2>
            <p className="text-muted-foreground mb-4">Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Access personal data we hold about you</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent for communications</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              To exercise these rights, contact{" "}
              <a href="mailto:privacy@zopro.app" className="text-primary hover:underline">privacy@zopro.app</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. Updates will be posted with a revised Effective Date. Continued use of the Service after changes become effective constitutes acceptance of the updated Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Contact Information</h2>
            <p className="text-muted-foreground">
              <strong>GPTek LLC</strong>
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Email:</strong>{" "}
              <a href="mailto:privacy@zopro.app" className="text-primary hover:underline">privacy@zopro.app</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
