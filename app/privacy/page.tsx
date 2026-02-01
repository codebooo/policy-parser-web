import { Card, CardContent } from "@/components/ui/card"

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>

      <Card className="border-primary/20 bg-background/40 backdrop-blur-md">
        <CardContent className="space-y-6 text-muted-foreground leading-relaxed pt-6">
          <p className="text-sm">Last Updated: December 11, 2024</p>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. About This Policy</h2>
            <p>
              PolicyParser is an educational tool that helps users understand privacy policies.
              This privacy policy explains how we handle data when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Data We Collect</h2>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">For Anonymous Users (No Account)</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Document Content:</strong> When you submit a policy for analysis without an account, the text is processed in memory and not permanently stored in our database.</li>
              <li><strong>Usage Data:</strong> We may collect basic usage analytics (page views, feature usage) to improve the service.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">For Registered Users</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Email address and authentication data required to create your account.</li>
              <li><strong>Analysis History:</strong> We store your analysis results, including the domain analyzed, scores, summaries, and key findings.</li>
              <li><strong>Policy Text:</strong> For cached analyses, we may store the extracted policy text to improve response times.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Third-Party Services</h2>
            <p className="mb-4">We use the following third-party services to operate PolicyParser:</p>

            <div className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg mb-4">
              <h4 className="font-semibold text-blue-200 mb-2">Google Gemini AI</h4>
              <p className="text-sm">
                Policy text you submit is sent to Google&apos;s Gemini API for AI-powered analysis.
                Google&apos;s use of this data is governed by their
                <a href="https://policies.google.com/privacy" className="text-primary underline ml-1" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </p>
            </div>

            <div className="p-4 bg-green-900/20 border border-green-800/50 rounded-lg mb-4">
              <h4 className="font-semibold text-green-200 mb-2">Supabase</h4>
              <p className="text-sm">
                User accounts and analysis history are stored in Supabase, a secure database platform.
                Supabase&apos;s data handling is governed by their
                <a href="https://supabase.com/privacy" className="text-primary underline ml-1" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </p>
            </div>

            <div className="p-4 bg-purple-900/20 border border-purple-800/50 rounded-lg">
              <h4 className="font-semibold text-purple-200 mb-2">Web Scraping</h4>
              <p className="text-sm">
                When you enter a URL, we fetch the publicly accessible policy page from that website.
                We do not access any password-protected or private content.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>To provide the service:</strong> Analyzing policies and displaying results.</li>
              <li><strong>To improve the service:</strong> Understanding usage patterns and fixing issues.</li>
              <li><strong>To cache results:</strong> Storing analysis results to provide faster responses for previously analyzed policies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Anonymous analyses:</strong> Not permanently stored.</li>
              <li><strong>Registered user data:</strong> Stored until you delete your account or request deletion.</li>
              <li><strong>Cached analyses:</strong> May be retained for up to 30 days to improve performance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Your Rights</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> You can view your analysis history in your account dashboard.</li>
              <li><strong>Deletion:</strong> You can delete your account and all associated data.</li>
              <li><strong>Export:</strong> You can download your analysis history.</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Cookies</h2>
            <p>
              We use essential cookies to maintain your session state. We do not use tracking
              cookies for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Significant changes will be announced
              on our website. We recommend reviewing this page periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Contact</h2>
            <p>
              For privacy-related questions or requests, please contact us through our support page.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
