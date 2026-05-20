'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { useAuth } from '@/lib/auth';
import { mockComplaints } from '@/lib/mock-data';
import { Plus, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const userComplaints = mockComplaints.filter(c => c.studentId === user?.id);
  const stats = {
    total: userComplaints.length,
    pending: userComplaints.filter(c => ['submitted', 'ai-checked', 'confirmed', 'notified'].includes(c.status)).length,
    inProgress: userComplaints.filter(c => ['under-review', 'in-progress'].includes(c.status)).length,
    resolved: userComplaints.filter(c => c.status === 'resolved').length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, {user?.name}
          </h1>
          <p className="text-slate-600">Manage your complaints and track their progress</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
              <FileText className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-slate-600 mt-1">All your submissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <p className="text-xs text-slate-600 mt-1">Awaiting response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <AlertCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              <p className="text-xs text-slate-600 mt-1">Being addressed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.resolved}</div>
              <p className="text-xs text-slate-600 mt-1">Successfully closed</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 sm:mb-0">Recent Reports</h2>
          <Link href="/dashboard/new-complaint">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Complaint
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          {mockComplaints.slice(0, 5).map((complaint) => (
            <Card key={complaint.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        href={`/dashboard/reports/${complaint.id}`}
                        className="text-lg font-semibold text-slate-900 hover:text-indigo-600"
                      >
                        {complaint.title}
                      </Link>
                      <StatusBadge status={complaint.status} />
                    </div>
                    <p className="text-slate-600 mb-3 line-clamp-2">
                      {complaint.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>{complaint.instituteName}</span>
                      <span>•</span>
                      <span className="capitalize">{complaint.category}</span>
                      <span>•</span>
                      <span>{new Date(complaint.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {mockComplaints.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No complaints yet</h3>
              <p className="text-slate-600 mb-4">Start by submitting your first complaint</p>
              <Link href="/dashboard/new-complaint">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Complaint
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
