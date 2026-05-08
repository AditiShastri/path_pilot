import { useState, useEffect } from 'react';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
}

export interface UseLocationReturn {
  location: LocationData | null;
  error: string | null;
  loading: boolean;
  requestLocation: () => void;
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const locationData: LocationData = {
          latitude,
          longitude,
          accuracy,
        };

        // Try to get address from coordinates using reverse geocoding
        try {
          const response = await fetch(
            `https://api.tomtom.com/search/2/reverseGeocode/${latitude},${longitude}.json?key=${process.env.NEXT_PUBLIC_TOMTOM_API_KEY || ''}`
          );
          if (response.ok) {
            const data = await response.json();
            const address = data?.addresses?.[0]?.address?.freeformAddress;
            if (address) {
              locationData.address = address;
            }
          }
        } catch (err) {
          console.warn('Failed to reverse geocode location:', err);
        }

        setLocation(locationData);
        setLoading(false);
      },
      (err) => {
        let errorMessage = 'Failed to get location';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setError(errorMessage);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  // Auto-request location on mount if permission was previously granted
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          requestLocation();
        }
      });
    }
  }, []);

  return {
    location,
    error,
    loading,
    requestLocation,
  };
}