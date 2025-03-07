import { 
  ChangeEvent, 
  useCallback, 
  useEffect, 
  useMemo,
  useRef
} from 'react';
import { 
  MediaFile, 
  MediaTypeOption, 
  LocationTypeOption,
  MediaType,
  MediaSubType
} from './types';

interface MetadataFormProps {
  file: MediaFile;
  onUpdate: (updates: Partial<MediaFile>) => void;
  mediaTypes: MediaTypeOption[];
  locationTypes: LocationTypeOption[];
}

export default function MetadataForm({ 
  file, 
  onUpdate,
  mediaTypes,
  locationTypes
}: MetadataFormProps) {
  const prevMediaType = useRef(file.mediaType);
  const prevLocationType = useRef(file.locationType);

  // Get available subtypes based on selected type
  const availableMediaSubTypes = useMemo(() => {
    const selectedType = mediaTypes.find(t => t.value === file.mediaType);
    return selectedType?.subTypes || [];
  }, [mediaTypes, file.mediaType]);

  const availableLocationSubTypes = useMemo(() => {
    const selectedType = locationTypes.find(t => t.value === file.locationType);
    return selectedType?.subTypes || [];
  }, [locationTypes, file.locationType]);

  // Reset subtype when type changes
  useEffect(() => {
    if (file.mediaType !== prevMediaType.current) {
      prevMediaType.current = file.mediaType;
      if (file.mediaType && !availableMediaSubTypes.some(st => st.value === file.mediaSubType)) {
        onUpdate({ mediaSubType: undefined });
      }
    }
  }, [file.mediaType, availableMediaSubTypes, onUpdate]);

  useEffect(() => {
    if (file.locationType !== prevLocationType.current) {
      prevLocationType.current = file.locationType;
      if (file.locationType && !availableLocationSubTypes.some(st => st.value === file.locationSubType)) {
        onUpdate({ locationSubType: undefined });
      }
    }
  }, [file.locationType, availableLocationSubTypes, onUpdate]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onUpdate({ [name]: value });
  }, [onUpdate]);

  const handleSelectChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    onUpdate({ [name]: value || undefined });
  }, [onUpdate]);

  const inputClassName = "block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-white dark:bg-gray-800 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6";
  const labelClassName = "block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200";
  const selectClassName = "block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 dark:text-white dark:bg-gray-800 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6";

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label htmlFor="title" className={labelClassName}>
          Title
        </label>
        <input
          type="text"
          name="title"
          id="title"
          className={inputClassName}
          value={file.title}
          onChange={handleInputChange}
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClassName}>
          Description
        </label>
        <textarea
          name="description"
          id="description"
          rows={3}
          className={inputClassName}
          value={file.description || ''}
          onChange={handleInputChange}
        />
      </div>

      <div>
        <label htmlFor="mediaType" className={labelClassName}>
          Media Type
        </label>
        <select
          name="mediaType"
          id="mediaType"
          className={selectClassName}
          value={file.mediaType || ''}
          onChange={handleSelectChange}
        >
          <option value="">Select type...</option>
          {mediaTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="mediaSubType" className={`${labelClassName} ${!file.mediaType ? 'text-gray-400 dark:text-gray-500' : ''}`}>
          Media Sub-Type
        </label>
        <select
          name="mediaSubType"
          id="mediaSubType"
          className={`${selectClassName} ${!file.mediaType ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
          value={file.mediaSubType || ''}
          onChange={handleSelectChange}
          disabled={!file.mediaType}
        >
          <option value="">Select sub-type...</option>
          {availableMediaSubTypes.map(subType => (
            <option key={subType.value} value={subType.value}>
              {subType.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="locationType" className={labelClassName}>
          Location Type
        </label>
        <select
          name="locationType"
          id="locationType"
          className={selectClassName}
          value={file.locationType || ''}
          onChange={handleSelectChange}
        >
          <option value="">Select type...</option>
          {locationTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="locationSubType" className={`${labelClassName} ${!file.locationType ? 'text-gray-400 dark:text-gray-500' : ''}`}>
          Location Sub-Type
        </label>
        <select
          name="locationSubType"
          id="locationSubType"
          className={`${selectClassName} ${!file.locationType ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
          value={file.locationSubType || ''}
          onChange={handleSelectChange}
          disabled={!file.locationType}
        >
          <option value="">Select sub-type...</option>
          {availableLocationSubTypes.map(subType => (
            <option key={subType.value} value={subType.value}>
              {subType.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
