import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Shield, CheckCircle, FileText } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 text-white py-20 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <Badge className="mb-6 bg-white/20 text-white border-white/30">
              Trusted by 500+ Educational Institutions
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Report. Verify. Resolve.
            </h1>
            <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
              A transparent complaint and accountability system empowering students to create safer, better educational environments.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50">
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-white">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">How EduWatch Works</h2>
            <p className="text-lg text-slate-600">Simple, transparent, and effective</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle>1. Report an Issue</CardTitle>
                <CardDescription>
                  Submit complaints about infrastructure, academics, safety, or hygiene issues.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle>2. AI Verification</CardTitle>
                <CardDescription>
                  Our AI system verifies and categorizes complaints, detecting duplicates.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle>3. Track Resolution</CardTitle>
                <CardDescription>
                  Monitor progress in real-time as institutions respond and resolve issues.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 mb-2">12,847</div>
              <div className="text-slate-600">Issues Reported</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-600 mb-2">8,234</div>
              <div className="text-slate-600">Issues Resolved</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-600 mb-2">94%</div>
              <div className="text-slate-600">Satisfaction Rate</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-900 mb-2">500+</div>
              <div className="text-slate-600">Institutions</div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-indigo-600 text-white py-16 px-4">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Make a Difference?</h2>
          <p className="text-xl text-indigo-100 mb-8">
            Join thousands of students creating positive change in their institutions.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50">
              Start Reporting Issues <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
