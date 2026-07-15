import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/lib/supabase';

export interface Region {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

// Haversine formula to compute distance between coordinates in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useLocationCluster() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [isOverridden, setIsOverridden] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch all regions from DB
  useEffect(() => {
    async function loadRegions() {
      try {
        const { data, error } = await supabase.from('regions').select('*');
        if (error) throw error;
        if (data) {
          const formatted: Region[] = data.map((r: any) => ({
            id: r.id,
            name: r.name,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            radius_meters: Number(r.radius_meters)
          }));
          setRegions(formatted);
          await initializeRegion(formatted);
        }
      } catch (err) {
        console.error('Error fetching regions:', err);
        setLoading(false);
      }
    }
    loadRegions();
  }, []);

  async function initializeRegion(availableRegions: Region[]) {
    setLoading(true);
    try {
      // 1. Check if user has a manual override saved in local preferences
      const { value: storedOverride } = await Preferences.get({ key: 'manual_region_override' });
      
      if (storedOverride) {
        const found = availableRegions.find(r => r.id === storedOverride);
        if (found) {
          setSelectedRegion(found);
          setIsOverridden(true);
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to location coordinates
      let permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        permission = await Geolocation.requestPermissions();
      }

      if (permission.location === 'granted') {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 5000
        });

        const { latitude, longitude } = position.coords;
        let matchedRegion: Region | null = null;
        let minDistance = Infinity;

        // Find closest region within its geo radius
        for (const region of availableRegions) {
          const dist = getDistance(latitude, longitude, region.latitude, region.longitude);
          if (dist <= region.radius_meters && dist < minDistance) {
            minDistance = dist;
            matchedRegion = region;
          }
        }

        if (matchedRegion) {
          setSelectedRegion(matchedRegion);
          setIsOverridden(false);
          setLoading(false);
          return;
        }
      }

      // 3. Fallback to default (Jordan Valley) if no match found or permission denied
      const fallback = availableRegions.find(r => r.name === 'Jordan Valley') || availableRegions[0];
      setSelectedRegion(fallback || null);
      setIsOverridden(false);
    } catch (err) {
      console.warn('Geolocation failed or timed out. Defaulting to Jordan Valley.', err);
      const fallback = availableRegions.find(r => r.name === 'Jordan Valley') || availableRegions[0];
      setSelectedRegion(fallback || null);
      setIsOverridden(false);
    } finally {
      setLoading(false);
    }
  }

  // Handle manual selection override
  async function selectRegionManual(regionId: string) {
    const found = regions.find(r => r.id === regionId);
    if (found) {
      setSelectedRegion(found);
      setIsOverridden(true);
      await Preferences.set({ key: 'manual_region_override', value: regionId });
    }
  }

  // Reset override and recalculate based on physical location
  async function clearOverride() {
    await Preferences.remove({ key: 'manual_region_override' });
    setIsOverridden(false);
    await initializeRegion(regions);
  }

  return {
    regions,
    selectedRegion,
    isOverridden,
    loading,
    selectRegionManual,
    clearOverride
  };
}
