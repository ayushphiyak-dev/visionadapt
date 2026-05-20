'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/status-badge';
import { useAuth } from '@/lib/auth';
import { mockComplaints } from '@/lib/mock-data';
import { Search } from 'lucide-react';

export default function ReportsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const filteredComplaints = mockComplaints.filter(complaint =>
    complaint.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    complaint.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Reports</h1>
          <p className="text-slate-600">View and track all your submitted complaints</p>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredComplaints.map((complaint) => (
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
                      {complaint.confirmations > 0 && (
                        <>
                          <span>•</span>
                          <span>{complaint.confirmations} confirmations</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredComplaints.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600">No reports found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
