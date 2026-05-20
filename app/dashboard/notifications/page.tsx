'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Notifications</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600">No new notifications</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
