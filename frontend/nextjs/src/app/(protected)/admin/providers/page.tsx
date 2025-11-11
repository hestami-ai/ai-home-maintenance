"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddProviderModal } from '@/components/services/AddProviderModal';
import { PendingInterventions } from '@/components/services/PendingInterventions';
import { PlusCircle, AlertCircle } from 'lucide-react';

export default function ProviderManagementPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);

  const handleProviderAdded = (scrapedDataId: string) => {
    console.log('Provider added:', scrapedDataId);
    // Optionally show a toast notification or refresh data
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Provider Management</h1>
          <p className="text-muted-foreground mt-1">
            Add and manage service providers in the roster
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} size="lg">
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Provider
        </Button>
      </div>

      <Tabs defaultValue="interventions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="interventions" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Pending Interventions
          </TabsTrigger>
          <TabsTrigger value="recent">Recent Additions</TabsTrigger>
        </TabsList>

        <TabsContent value="interventions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review Required</CardTitle>
              <CardDescription>
                These providers need manual review to determine if they match existing records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingInterventions />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Additions</CardTitle>
              <CardDescription>
                Recently added providers and their processing status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coming soon: View recently processed providers
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddProviderModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={handleProviderAdded}
      />
    </div>
  );
}
