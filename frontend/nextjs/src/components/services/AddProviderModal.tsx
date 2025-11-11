"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AddProviderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (scrapedDataId: string) => void;
}

interface FormData {
  source_name: string;
  source_url: string;
  raw_html: string;
  notes: string;
}

export function AddProviderModal({ open, onOpenChange, onSuccess }: AddProviderModalProps) {
  const [formData, setFormData] = useState<FormData>({
    source_name: '',
    source_url: '',
    raw_html: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/services/providers/add-to-roster/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add provider');
      }

      const data = await response.json();
      setSuccess(true);
      
      // Reset form
      setFormData({
        source_name: '',
        source_url: '',
        raw_html: '',
        notes: ''
      });

      // Call success callback
      if (onSuccess) {
        onSuccess(data.id);
      }

      // Close modal after 2 seconds
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Provider to Roster</DialogTitle>
          <DialogDescription>
            Add a service provider from an external source. The system will automatically extract and process the provider information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source Name */}
          <div className="space-y-2">
            <Label htmlFor="source_name">Source Name *</Label>
            <Input
              id="source_name"
              placeholder="e.g., Yelp, Angi, Google"
              value={formData.source_name}
              onChange={(e) => handleChange('source_name', e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Source URL */}
          <div className="space-y-2">
            <Label htmlFor="source_url">Source URL *</Label>
            <Input
              id="source_url"
              type="url"
              placeholder="https://www.yelp.com/biz/acme-hvac"
              value={formData.source_url}
              onChange={(e) => handleChange('source_url', e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Raw HTML (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="raw_html">Raw HTML (Optional)</Label>
            <Textarea
              id="raw_html"
              placeholder="Paste the HTML content here if available..."
              value={formData.raw_html}
              onChange={(e) => handleChange('raw_html', e.target.value)}
              rows={4}
              disabled={loading}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to fetch automatically from the URL
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes or context..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              disabled={loading}
            />
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                Provider added successfully! Processing will begin shortly.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || success}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Adding...' : 'Add Provider'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
