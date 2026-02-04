/**
 * Validation Page for AFRO Storm
 * Tests the system against historical cyclones
 */

import { ValidationMap } from '@/components/map/ValidationMap';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Validation() {
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">AFRO Storm Validation</h1>
            <p className="text-xs text-slate-400">Historical cyclone detection testing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
            <FileText className="w-4 h-4 mr-2" />
            View Report
          </Button>
          <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative">
        <ValidationMap />
      </main>
    </div>
  );
}

export default Validation;
