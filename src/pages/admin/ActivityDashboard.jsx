import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Users, MessageSquare, DollarSign } from 'lucide-react';

// Mock charts for visual (Recharts/Chart.js would be used in production)
const ActivityDashboard = () => {
  return (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white">Activity Dashboard</h2>
        
        <div className="grid gap-4 md:grid-cols-4">
             <Card className="bg-slate-900 border-slate-800 text-white">
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                     <CardTitle className="text-sm font-medium text-slate-400">DAU (Daily Active)</CardTitle>
                     <Activity className="h-4 w-4 text-blue-500" />
                 </CardHeader>
                 <CardContent><div className="text-2xl font-bold">1,245</div></CardContent>
             </Card>
             <Card className="bg-slate-900 border-slate-800 text-white">
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                     <CardTitle className="text-sm font-medium text-slate-400">Total Messages (24h)</CardTitle>
                     <MessageSquare className="h-4 w-4 text-green-500" />
                 </CardHeader>
                 <CardContent><div className="text-2xl font-bold">8,502</div></CardContent>
             </Card>
             <Card className="bg-slate-900 border-slate-800 text-white">
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                     <CardTitle className="text-sm font-medium text-slate-400">Matches (24h)</CardTitle>
                     <Users className="h-4 w-4 text-purple-500" />
                 </CardHeader>
                 <CardContent><div className="text-2xl font-bold">340</div></CardContent>
             </Card>
             <Card className="bg-slate-900 border-slate-800 text-white">
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                     <CardTitle className="text-sm font-medium text-slate-400">Premium Revenue (Mo)</CardTitle>
                     <DollarSign className="h-4 w-4 text-yellow-500" />
                 </CardHeader>
                 <CardContent><div className="text-2xl font-bold">$12,450</div></CardContent>
             </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-slate-900 border-slate-800 text-white h-96">
                <CardHeader><CardTitle>User Growth Trend</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-center h-full pb-10 text-slate-500">
                    [Line Chart Placeholder: Users over 30 days]
                </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800 text-white h-96">
                <CardHeader><CardTitle>Geographic Distribution</CardTitle></CardHeader>
                 <CardContent className="flex items-center justify-center h-full pb-10 text-slate-500">
                    [Map/Pie Chart Placeholder: Users by City]
                </CardContent>
            </Card>
        </div>
    </div>
  );
};

export default ActivityDashboard;