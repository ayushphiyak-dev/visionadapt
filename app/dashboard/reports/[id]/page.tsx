'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import { ConfidenceScore } from '@/components/confidence-score';
import { useAuth } from '@/lib/auth';
import { mockComplaints } from '@/lib/mock-data';
import { ArrowLeft, MapPin, Calendar, Eye, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ReportDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const complaint = mockComplaints.find(c => c.id === params.id);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  if (!complaint) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Complaint Not Found</h2>
              <p className="text-slate-600 mb-4">The complaint you're looking for doesn't exist.</p>
              <Link href="/dashboard/reports">
                <Button>Back to Reports</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <Link href="/dashboard/reports">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Button>
        </Link>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-2xl">{complaint.title}</CardTitle>
                    <StatusBadge status={complaint.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {complaint.instituteName}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(complaint.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {complaint.viewCount} views
                    </div>
                  </div>
                </div>
                {complaint.aiAnalysis && (
                  <ConfidenceScore score={complaint.aiAnalysis.confidence} size="sm" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Description</h3>
                <p className="text-slate-700 whitespace-pre-wrap">{complaint.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Category</h3>
                  <Badge variant="secondary" className="capitalize">{complaint.category}</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Urgency</h3>
                  <Badge variant="warning" className="capitalize">{complaint.urgency}</Badge>
                </div>
              </div>

              {complaint.location && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Location</h3>
                  <p className="text-slate-700">{complaint.location}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {complaint.instituteResponse && (
            <Card>
              <CardHeader>
                <CardTitle>Institute Response</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-slate-700">{complaint.instituteResponse.message}</p>
                  <div className="text-sm text-slate-600">
                    <span>Responded by {complaint.instituteResponse.respondedBy}</span>
                    <span className="mx-2">•</span>
                    <span>{new Date(complaint.instituteResponse.respondedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {complaint.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {complaint.timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-indigo-600"></div>
                        {index < complaint.timeline.length - 1 && (
                          <div className="flex-1 w-0.5 bg-slate-200 mt-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <h4 className="font-semibold text-slate-900">{event.title}</h4>
                        <p className="text-sm text-slate-600">{event.description}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
