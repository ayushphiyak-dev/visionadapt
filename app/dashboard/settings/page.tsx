'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Settings</h1>
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">Settings management coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
