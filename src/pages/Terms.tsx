import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
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
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">
            Effective Date: January 7, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              These Terms of Service ("Terms") govern your access to and use of the ZoPro field service management application and related services (the "Service"), which are owned and operated by GPTek LLC ("Company," "we," "our," or "us").
            </p>
            <p className="text-muted-foreground mt-4">
              By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you may not use the Service.
            </p>
            <p className="text-muted-foreground mt-4">
              These Terms apply to all users, including business owners, employees, and authorized personnel.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground">
              ZoPro is a field service management platform operated by GPTek LLC that provides tools for managing customers, jobs, quotes, invoices, scheduling, time tracking, and team coordination.
            </p>
            <p className="text-muted-foreground mt-4">
              The Service is provided on an "as is" and "as available" basis. We reserve the right to modify, suspend, or discontinue any part of the Service at any time without liability.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground mb-4">To use the Service, you must:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Be at least 18 years old</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the confidentiality of your login credentials</li>
              <li>Promptly notify us of unauthorized account access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              We reserve the right to suspend or terminate accounts containing false or misleading information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Acceptable Use</h2>
            <p className="text-muted-foreground mb-4">You agree not to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Use the Service for unlawful purposes</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Attempt unauthorized access to systems or networks</li>
              <li>Interfere with Service performance or security</li>
              <li>Upload malware, malicious code, or harmful content</li>
              <li>Collect or harvest user data without authorization</li>
              <li>Send spam or unsolicited communications through the Service</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Violation may result in immediate suspension or termination.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Your Data</h2>
            <p className="text-muted-foreground">
              You retain ownership of all data you upload ("Your Data").
            </p>
            <p className="text-muted-foreground mt-4">
              You grant GPTek LLC a limited, non-exclusive license to store, process, and display Your Data solely to provide and improve the Service.
            </p>
            <p className="text-muted-foreground mt-4">
              You are responsible for maintaining backups. To the maximum extent permitted by law, we are not liable for data loss.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Payment Terms</h2>
            <p className="text-muted-foreground mb-4">If you use paid features:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>You agree to pay all applicable fees at the time of purchase</li>
              <li>Payments are processed through third-party providers (e.g., Stripe)</li>
              <li>Fees are non-refundable unless stated otherwise</li>
              <li>We may modify pricing with reasonable notice</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Failure to pay may result in suspension or termination.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. SMS Program Terms</h2>
            <p className="text-muted-foreground mb-4">
              If you provide your phone number and consent to receive SMS notifications from ZoPro (operated by GPTek LLC), you agree to receive transactional messages including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>One-time passcodes</li>
              <li>Account alerts</li>
              <li>Job confirmations and reminders</li>
              <li>Security notifications</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Message frequency varies. Message and data rates may apply.
            </p>
            <p className="text-muted-foreground mt-2">
              You may opt out at any time by replying <strong>STOP</strong>.
            </p>
            <p className="text-muted-foreground mt-2">
              For assistance, reply <strong>HELP</strong> or contact{" "}
              <a href="mailto:legal@zopro.app" className="text-primary hover:underline">legal@zopro.app</a>.
            </p>
            <p className="text-muted-foreground mt-4">
              Consent to receive SMS messages is not a condition of purchase. We do not sell or share phone numbers for third-party marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The Service, including all software, content, trademarks, and functionality, is the property of GPTek LLC and is protected by intellectual property laws.
            </p>
            <p className="text-muted-foreground mt-4">
              You may not copy, reproduce, modify, distribute, or create derivative works without prior written consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Third-Party Services</h2>
            <p className="text-muted-foreground">
              The Service may integrate with third-party providers such as Google, Stripe, Supabase, Twilio, or other service vendors.
            </p>
            <p className="text-muted-foreground mt-4">
              Your use of third-party services is subject to their respective terms and privacy policies. GPTek LLC is not responsible for third-party services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-muted-foreground mt-4">
              WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, GPTek LLC SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">12. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify and hold harmless GPTek LLC and its officers, directors, employees, and agents from claims, damages, losses, and expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">13. Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate your account at our discretion for violation of these Terms or conduct harmful to users or the Company.
            </p>
            <p className="text-muted-foreground mt-4">
              Upon termination, your right to access the Service immediately ceases.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">14. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms at any time. Updates will be posted with a revised Effective Date. Continued use of the Service constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">15. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by the laws of the jurisdiction in which GPTek LLC is organized, without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">16. Contact Information</h2>
            <p className="text-muted-foreground">
              <strong>GPTek LLC</strong>
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Email:</strong>{" "}
              <a href="mailto:legal@zopro.app" className="text-primary hover:underline">legal@zopro.app</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
