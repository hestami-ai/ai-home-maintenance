"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, CheckCircle2, PlusCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CandidateProvider {
  id: string;
  business_name: string;
  phone?: string;
  website?: string;
}

interface PendingIntervention {
  id: string;
  source_name: string;
  source_url: string;
  last_scraped_at: string;
  intervention_reason: string;
  candidate_providers: CandidateProvider[];
  match_scores: Record<string, number>;
}

export function PendingInterventions() {
  const [interventions, setInterventions] = useState<PendingIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<PendingIntervention | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchInterventions();
  }, []);

  const fetchInterventions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/services/providers/interventions/');
      if (!response.ok) {
        throw new Error('Failed to fetch pending interventions');
      }

      const data = await response.json();
      setInterventions(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (action: 'link' | 'create', providerId?: string) => {
    if (!selectedIntervention) return;

    setResolving(true);
    try {
      const response = await fetch(
        `/api/services/providers/scraped/${selectedIntervention.id}/resolve/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            provider_id: providerId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resolve intervention');
      }

      // Refresh the list
      await fetchInterventions();
      setSelectedIntervention(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (interventions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <CheckCircle2 className="mx-auto h-12 w-12 mb-2" />
            <p>No pending interventions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {interventions.map((intervention) => (
          <Card key={intervention.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {intervention.source_name}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <a
                      href={intervention.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline"
                    >
                      View Source <ExternalLink className="h-3 w-3" />
                    </a>
                    <span>•</span>
                    <span>{new Date(intervention.last_scraped_at).toLocaleDateString()}</span>
                  </CardDescription>
                </div>
                <Badge variant="secondary">Needs Review</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Reason:</p>
                  <p className="text-sm text-muted-foreground">
                    {intervention.intervention_reason}
                  </p>
                </div>

                {intervention.candidate_providers.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Potential Matches:</p>
                    <div className="space-y-2">
                      {intervention.candidate_providers.map((provider) => (
                        <div
                          key={provider.id}
                          className="flex items-center justify-between p-2 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{provider.business_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {provider.phone && <span>{provider.phone}</span>}
                              {provider.phone && provider.website && <span> • </span>}
                              {provider.website && <span>{provider.website}</span>}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {Math.round(intervention.match_scores[provider.id] || 0)}% match
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => setSelectedIntervention(intervention)}
                  className="w-full"
                >
                  Resolve Intervention
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resolution Dialog */}
      <Dialog
        open={!!selectedIntervention}
        onOpenChange={(open) => !open && setSelectedIntervention(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Intervention</DialogTitle>
            <DialogDescription>
              Choose how to handle this provider
            </DialogDescription>
          </DialogHeader>

          {selectedIntervention && (
            <div className="space-y-4">
              {selectedIntervention.candidate_providers.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Link to Existing Provider:</p>
                  <div className="space-y-2">
                    {selectedIntervention.candidate_providers.map((provider) => (
                      <Button
                        key={provider.id}
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => handleResolve('link', provider.id)}
                        disabled={resolving}
                      >
                        <span>{provider.business_name}</span>
                        <Badge variant="secondary">
                          {Math.round(selectedIntervention.match_scores[provider.id] || 0)}%
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                variant="default"
                className="w-full"
                onClick={() => handleResolve('create')}
                disabled={resolving}
              >
                {resolving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                Create New Provider
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
