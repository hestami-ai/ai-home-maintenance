// This layout server file is used to handle property-specific data loading
// Authentication is already handled by the parent layout

export const load = async ({ params, parent }) => {
  // Get the data from the parent layout
  const parentData = await parent();
  
  // In a real app, we would fetch the property data here based on the ID
  // For now, we'll just pass the property ID from the URL params
  
  return {
    // Spread the parent data to maintain user authentication info
    ...parentData,
    // Add property-specific data
    propertyId: params.id
  };
};
