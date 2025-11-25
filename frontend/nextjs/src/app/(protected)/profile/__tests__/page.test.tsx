import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ProfilePage from '../page';

// Mock next-auth
jest.mock('next-auth/react');
// Mock next/navigation
jest.mock('next/navigation');

// Mock fetch
global.fetch = jest.fn();

describe('ProfilePage', () => {
  const mockSession = {
    user: {
      email: 'test@example.com',
      userType: 'PROPERTY_OWNER',
    },
    expires: '2024-01-01',
  };

  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mocks
    (useSession as jest.Mock).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    });
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        business_name: 'Test Company',
        billing_address: '123 Test St',
        tax_id: '123456789',
      }),
    });
  });

  it('renders profile page with property owner fields', async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Company Name')).toBeInTheDocument();
      expect(screen.getByText('Billing Address')).toBeInTheDocument();
      expect(screen.getByText('Tax ID')).toBeInTheDocument();
    });
  });

  it('renders profile page with service provider fields', async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, userType: 'SERVICE_PROVIDER' },
      },
      status: 'authenticated',
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Business License')).toBeInTheDocument();
      expect(screen.getByText('Service Areas')).toBeInTheDocument();
      expect(screen.getByText('Service Categories')).toBeInTheDocument();
    });
  });

  it('handles edit mode correctly', async () => {
    render(<ProfilePage />);

    // Initial state - fields should be disabled
    const businessNameInput = screen.getByLabelText('Company Name');
    expect(businessNameInput).toBeDisabled();

    // Click edit button
    const editButton = screen.getByText('Edit Profile');
    fireEvent.click(editButton);

    // Fields should now be enabled
    expect(businessNameInput).not.toBeDisabled();

    // Cancel button should appear
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('handles form submission correctly', async () => {
    render(<ProfilePage />);

    // Enter edit mode
    const editButton = screen.getByText('Edit Profile');
    fireEvent.click(editButton);

    // Update a field
    const businessNameInput = screen.getByLabelText('Company Name');
    fireEvent.change(businessNameInput, { target: { value: 'New Company Name' } });

    // Submit form
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    // Verify API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/profile',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('New Company Name'),
        })
      );
    });
  });

  it('displays error message when API call fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    render(<ProfilePage />);

    // Enter edit mode and submit form
    const editButton = screen.getByText('Edit Profile');
    fireEvent.click(editButton);
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to update profile')).toBeInTheDocument();
    });
  });

  it('displays success message after successful update', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    render(<ProfilePage />);

    // Enter edit mode and submit form
    const editButton = screen.getByText('Edit Profile');
    fireEvent.click(editButton);
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully')).toBeInTheDocument();
    });
  });
});
