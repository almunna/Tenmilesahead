// app/privacy/page.tsx
export default function Privacy() {
  return (
    <div className="container py-10 space-y-4">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p>
        <strong>Effective Date:</strong> July 2025
        <br />
        <strong>Last Updated:</strong> July 2025
      </p>
      <p>
        TenMilesAhead.com is committed to protecting your privacy. This Privacy
        Policy describes how we collect, use, and protect your personal
        information when you use our software-as-a-service (SaaS) platform for
        tracking and managing RV data and maintenance (the “Service”). By using
        the Service, you agree to the terms of this Privacy Policy.
      </p>
      <h2 className="text-xl font-semibold mt-4">1. Information We Collect</h2>
      <p>
        <strong>Information You Provide:</strong> Account details (name, email
        address, password)
      </p>
      <p>
        <strong>Automatically Collected Information:</strong> Log data (IP
        address, browser type, operating system, usage timestamps), device
        identifiers, cookies and usage tracking data (see “Cookies” below)
      </p>

      <h2 className="text-xl font-semibold mt-4">
        2. How We Use Your Information
      </h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Provide and maintain the Service</li>
        <li>Send you important updates or notifications</li>
        <li>Improve functionality and performance</li>
        <li>Respond to user inquiries and support requests</li>
        <li>Ensure data security and prevent misuse</li>
      </ul>

      <h2 className="text-xl font-semibold mt-4">
        3. Data Storage and Backups
      </h2>
      <p>
        We use secure cloud-based infrastructure to store your data. However, we
        do not guarantee data retention and recommend you maintain regular
        personal backups of all critical information.
      </p>

      <h2 className="text-xl font-semibold mt-4">
        4. Data Sharing and Disclosure
      </h2>
      <p>
        We do not sell or rent your personal data. We may share your data only
        in these limited situations: with service providers (under
        confidentiality), to comply with legal obligations, or to protect the
        rights or safety of users or the public.
      </p>

      <h2 className="text-xl font-semibold mt-4">
        5. Cookies and Tracking Technologies
      </h2>
      <p>
        We use cookies and similar technologies to analyze usage and improve
        user experience. You can control cookie settings through your browser.
      </p>

      <h2 className="text-xl font-semibold mt-4">6. Data Retention</h2>
      <p>
        We retain your information as long as your account is active or as
        necessary to comply with legal obligations. You can request deletion at
        any time.
      </p>

      <h2 className="text-xl font-semibold mt-4">7. Your Rights</h2>
      <p>
        Depending on your location, you may have rights to access, update, or
        delete your data; object to or restrict certain uses; and withdraw
        consent (where applicable). To exercise your rights, contact us at
        admin@TenMilesAhead.com.
      </p>

      <h2 className="text-xl font-semibold mt-4">8. Data Security</h2>
      <p>
        We implement industry-standard safeguards, including encryption and
        access controls. However, no system is 100% secure.
      </p>

      <h2 className="text-xl font-semibold mt-4">9. Children’s Privacy</h2>
      <p>
        Our Service is not intended for children. We do not knowingly collect
        personal data from minors.
      </p>

      <h2 className="text-xl font-semibold mt-4">10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy. We will notify you of material
        changes via email or through the Service.
      </p>

      <h2 className="text-xl font-semibold mt-4">11. Contact Us</h2>
      <p>Email: admin@TenMilesAhead.com</p>
    </div>
  );
}
