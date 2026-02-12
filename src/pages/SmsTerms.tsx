import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const SmsTerms = () => {
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
          <h1 className="text-3xl font-bold mb-2">ZoPro SMS Terms & Conditions</h1>
          <p className="text-muted-foreground mb-8">
            Effective Date: January 7, 2026
          </p>

          <p className="text-muted-foreground mb-8">
            These SMS Terms & Conditions ("SMS Terms") govern text message communications sent by GPTek LLC, operator of the ZoPro application ("ZoPro," "we," "our," or "us").
          </p>
          <p className="text-muted-foreground mb-8">
            By providing your phone number and opting in to receive SMS messages, you agree to these SMS Terms.
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Program Description</h2>
            <p className="text-muted-foreground mb-4">
              ZoPro sends transactional SMS messages related to your use of the ZoPro field service management platform. These messages may include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>One-time verification codes (OTP)</li>
              <li>Account notifications</li>
              <li>Job confirmations and reminders</li>
              <li>Scheduling alerts</li>
              <li>Security-related messages</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              ZoPro does not send third-party marketing messages through this program.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Message Frequency</h2>
            <p className="text-muted-foreground">
              Message frequency varies depending on your account activity and usage of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Message and Data Rates</h2>
            <p className="text-muted-foreground">
              Message and data rates may apply based on your mobile carrier plan. GPTek LLC is not responsible for any charges imposed by your wireless provider.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Opt-In</h2>
            <p className="text-muted-foreground mb-4">You opt in to receive SMS messages by:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Entering your phone number during account registration in the ZoPro app, and</li>
              <li>Providing consent via a required checkbox acknowledging SMS communications.</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Consent to receive SMS messages is not a condition of purchase.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Opt-Out Instructions</h2>
            <p className="text-muted-foreground mb-4">
              You may opt out of SMS messages at any time by replying:
            </p>
            <p className="text-muted-foreground text-lg mb-4">
              <strong>STOP</strong>
            </p>
            <p className="text-muted-foreground">
              After you send <strong>STOP</strong>, you will receive a confirmation message and will no longer receive SMS messages from ZoPro unless you re-enroll.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Help Instructions</h2>
            <p className="text-muted-foreground mb-4">
              For assistance, reply:
            </p>
            <p className="text-muted-foreground text-lg mb-4">
              <strong>HELP</strong>
            </p>
            <p className="text-muted-foreground">
              You may also contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Email:</strong>{" "}
              <a href="mailto:legal@zopro.app" className="text-primary hover:underline">legal@zopro.app</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Carrier Disclaimer</h2>
            <p className="text-muted-foreground">
              Wireless carriers are not liable for delayed or undelivered messages.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Privacy</h2>
            <p className="text-muted-foreground">
              Your privacy is important to us. Information collected as part of the SMS program is handled in accordance with our Privacy Policy:
            </p>
            <p className="text-muted-foreground mt-2">
              <Link to="/privacy" className="text-primary hover:underline">https://fsm.zopro.app/privacy</Link>
            </p>
            <p className="text-muted-foreground mt-4">
              We do not sell or share phone numbers with third parties for their marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Eligibility</h2>
            <p className="text-muted-foreground">
              You must be at least 18 years old to participate in this SMS program.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Changes to SMS Terms</h2>
            <p className="text-muted-foreground">
              We may update these SMS Terms at any time. Changes will be posted on this page with an updated Effective Date. Continued participation in the SMS program constitutes acceptance of those changes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SmsTerms;
