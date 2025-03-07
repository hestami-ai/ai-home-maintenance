interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface AddressStepProps {
  address: Address;
  title: string;
  onChange: (address: Address) => void;
  onChangeTitle: (title: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function AddressStep({
  address,
  title,
  onChange,
  onChangeTitle,
  onSubmit,
  onCancel,
}: AddressStepProps) {
  const handleChange = (field: keyof Address) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({
      ...address,
      [field]: e.target.value,
    });
  };

  const isComplete = Object.values(address).every((value) => value.trim() !== '');

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Enter Property Address</h2>
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          Property Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
          placeholder="Enter property title"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="street"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Street Address
          </label>
          <input
            type="text"
            id="street"
            value={address.street}
            onChange={handleChange('street')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            placeholder="123 Main St"
          />
        </div>

        <div>
          <label
            htmlFor="city"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            City
          </label>
          <input
            type="text"
            id="city"
            value={address.city}
            onChange={handleChange('city')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            placeholder="San Francisco"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="state"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              State
            </label>
            <input
              type="text"
              id="state"
              value={address.state}
              onChange={handleChange('state')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="CA"
            />
          </div>

          <div>
            <label
              htmlFor="zipCode"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              ZIP Code
            </label>
            <input
              type="text"
              id="zipCode"
              value={address.zipCode}
              onChange={handleChange('zipCode')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="94105"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!isComplete}
          className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm ${
            isComplete
              ? 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Submit Property
        </button>
      </div>
    </div>
  );
}
