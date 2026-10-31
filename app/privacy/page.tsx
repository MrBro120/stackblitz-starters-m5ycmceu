import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy – House Connect",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        House Connect (“we”, “us”) respects your privacy. This policy explains
        what personal information we collect, why, and the choices you have. We
        aim to follow the Uganda Data Protection and Privacy Act, 2019.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> full name, email address, phone
          number and role (tenant or landlord).
        </li>
        <li>
          <strong>Listings:</strong> property details and photos that
          landlords upload.
        </li>
        <li>
          <strong>Viewing requests:</strong> which property you asked about
          and any message you write.
        </li>
        <li>
          <strong>Reports:</strong> reports you make about listings.
        </li>
        <li>
          <strong>Basic technical data:</strong> such as browser type and
          log information needed to run and secure the Service.
        </li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>To create and manage your account and let you log in.</li>
        <li>To show listings and process viewing requests.</li>
        <li>
          To let our administrator contact tenants and landlords to arrange
          viewings and follow up.
        </li>
        <li>To prevent fraud, handle reports and keep the Service safe.</li>
      </ul>

      <h2>3. Who sees your information</h2>
      <ul>
        <li>
          <strong>Landlords</strong> see your name and phone number when you
          request a viewing and the request is accepted.
        </li>
        <li>
          <strong>Tenants</strong> see a landlord’s contact details only after
          a viewing request is accepted.
        </li>
        <li>
          <strong>House Connect administrators</strong> can see account
          details, listings and viewing requests in order to run the Service.
        </li>
        <li>We do not sell your personal information.</li>
      </ul>

      <h2>4. Service providers</h2>
      <p>
        We use trusted providers to run the Service: Supabase (accounts and
        database), Cloudflare (storing property photos) and Vercel (hosting).
        They process data on our behalf and may store it on servers outside
        Uganda.
      </p>

      <h2>5. How long we keep it</h2>
      <p>
        We keep your information while your account is active and as long as
        needed to run the Service or meet legal duties. You can ask us to
        delete your account and data.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You may ask to access, correct or delete your personal information, or
        object to how it is used. Contact us using the details below.
      </p>

      <h2>7. Security</h2>
      <p>
        We use reasonable measures to protect your information, including
        secure logins and encrypted connections. No online service is 100%
        secure, so please use a strong password and keep it private.
      </p>

      <h2>8. Children</h2>
      <p>The Service is not meant for anyone under 18.</p>

      <h2>9. Changes</h2>
      <p>
        We may update this policy. The date at the top shows when it last
        changed.
      </p>

      <p style={{ background: "#FFF6E0", padding: 12, borderRadius: 8 }}>
        This page is a general template and should be reviewed by a lawyer
        before relying on it. Organisations that handle personal data in
        Uganda may need to register with the Personal Data Protection Office
        (NITA-U).
      </p>
    </LegalPage>
  );
}
