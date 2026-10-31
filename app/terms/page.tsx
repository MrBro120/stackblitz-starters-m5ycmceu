import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service – House Connect",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        Welcome to House Connect (“we”, “us”). By using www.houseconnect.site
        (the “Service”) you agree to these terms. If you do not agree, please
        do not use the Service.
      </p>

      <h2>1. What House Connect does</h2>
      <p>
        House Connect is an online platform that lets landlords list rental
        properties and lets tenants browse them and request viewings. We help
        people connect; we are not a party to any rental agreement between a
        landlord and a tenant.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You must provide accurate information (including a working phone
        number) and keep your password private. You are responsible for
        everything done through your account. You must be at least 18 years old
        to create an account.
      </p>

      <h2>3. Landlords</h2>
      <ul>
        <li>You may only list properties you own or are authorised to rent out.</li>
        <li>Listings, prices and photos must be accurate and not misleading.</li>
        <li>You must not post photos you do not have the right to use.</li>
        <li>We may remove or hide any listing that breaks these terms or is reported as false.</li>
      </ul>

      <h2>4. Tenants</h2>
      <ul>
        <li>Viewing requests must be genuine.</li>
        <li>
          When a viewing request is accepted, your name and phone number are
          shared with the landlord so you can be contacted.
        </li>
        <li>
          Always inspect a property in person before paying any money. Never
          pay a deposit or rent to someone you have not met or verified.
        </li>
      </ul>

      <h2>5. Follow-up by House Connect</h2>
      <p>
        When a tenant requests a viewing, the House Connect administrator may
        contact the tenant and the landlord (for example by phone or WhatsApp)
        to help arrange the viewing.
      </p>

      <h2>6. Not allowed</h2>
      <ul>
        <li>Fake, duplicate or fraudulent listings, or scams of any kind.</li>
        <li>Harassing, threatening or discriminating against other users.</li>
        <li>Attempting to break, overload or gain unauthorised access to the Service.</li>
        <li>Using the Service for anything unlawful.</li>
      </ul>

      <h2>7. Reports and removal</h2>
      <p>
        Users can report suspicious listings. We may suspend or delete accounts
        and listings at our discretion if these terms are broken.
      </p>

      <h2>8. No guarantees</h2>
      <p>
        We try to keep the Service available and accurate, but we do not
        guarantee that listings are free of errors, that a property is still
        available, or that the Service will be uninterrupted. We do not verify
        every listing and are not responsible for the conduct of users or for
        agreements or payments made between them.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, House Connect is not liable for
        any loss arising from your use of the Service or from dealings with
        other users.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms from time to time. Continued use of the
        Service after changes means you accept them.
      </p>

      <h2>11. Governing law</h2>
      <p>These terms are governed by the laws of Uganda.</p>

      <p style={{ background: "#FFF6E0", padding: 12, borderRadius: 8 }}>
        This page is a general template and should be reviewed by a lawyer
        before relying on it.
      </p>
    </LegalPage>
  );
}
