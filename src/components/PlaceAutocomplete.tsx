"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
};

type PlaceDetails = {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phoneNumber: string;
  websiteUrl: string;
  formattedAddress: string;
};

type PlaceAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (details: PlaceDetails) => void;
  placeholder?: string;
  className?: string;
};

export default function PlaceAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Search for a place...",
  className = "input",
}: PlaceAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const searchPlaces = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      console.log("Places API response:", data);

      if (data.error) {
        console.error("Places API error:", data.error);
        setSuggestions([]);
        return;
      }

      if (data.predictions && data.predictions.length > 0) {
        setSuggestions(data.predictions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Error fetching place suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      searchPlaces(newValue);
    }, 300);
  };

  // Handle place selection
  const handleSelectPlace = async (prediction: PlacePrediction) => {
    setIsLoading(true);
    setShowSuggestions(false);
    setSuggestions([]);

    try {
      const response = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(prediction.place_id)}`
      );
      const details = await response.json();

      if (!details.error) {
        // Update the name field
        onChange(details.name || prediction.structured_formatting?.main_text || prediction.description);
        // Notify parent of selected place details
        onPlaceSelect(details);
      } else {
        // If details fetch fails, just use the name from prediction
        onChange(prediction.structured_formatting?.main_text || prediction.description);
      }
    } catch (error) {
      console.error("Error fetching place details:", error);
      // Use prediction name as fallback
      onChange(prediction.structured_formatting?.main_text || prediction.description);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectPlace(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className={className}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.place_id}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                index === highlightedIndex
                  ? "bg-blue-50 dark:bg-blue-900/30"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
              onClick={() => handleSelectPlace(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {suggestion.structured_formatting?.main_text ||
                  suggestion.description}
              </div>
              {suggestion.structured_formatting?.secondary_text && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {suggestion.structured_formatting.secondary_text}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
