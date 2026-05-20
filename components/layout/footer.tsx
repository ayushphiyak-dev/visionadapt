import Link from 'next/link';
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/constants';
import { Mail, MessageSquare } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                E
              </div>
              <span className="text-lg font-bold text-slate-900">{APP_NAME}</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Empowering students with a transparent complaint and accountability system.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-slate-400 hover:text-slate-600">
                <MessageSquare className="h-5 w-5" />
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-slate-400 hover:text-slate-600">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Platform</h3>
            <ul className="space-y-3">
              <li><Link href="/institutes" className="text-sm text-slate-600 hover:text-indigo-600">Institutes</Link></li>
              <li><Link href="/issues" className="text-sm text-slate-600 hover:text-indigo-600">Public Issues</Link></li>
              <li><Link href="/help" className="text-sm text-slate-600 hover:text-indigo-600">Help Center</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Legal</h3>
            <ul className="space-y-3">
              <li><Link href="/terms" className="text-sm text-slate-600 hover:text-indigo-600">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-sm text-slate-600 hover:text-indigo-600">Privacy Policy</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Support</h3>
            <ul className="space-y-3">
              <li><a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-slate-600 hover:text-indigo-600">Contact Us</a></li>
              <li><Link href="/help" className="text-sm text-slate-600 hover:text-indigo-600">FAQs</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-slate-200">
          <p className="text-center text-sm text-slate-500">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved. Built for educational institutions.
          </p>
        </div>
      </div>
    </footer>
  );
}
