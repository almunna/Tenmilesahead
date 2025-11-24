"use client";

import React from "react";
import {
  Plane,
  Bus,
  Car,
  Ship,
  CarTaxiFront,
  Footprints,
  Train,
  Truck,
  Home,
  Building2,
  Hotel,
  MoreHorizontal,
  Calendar,
  Camera,
  Globe,
  MapPin,
} from "lucide-react";

export type TravelStats = {
  totalTrips: number;
  daysExplored: number;
  photosCaptured: number;
  countriesVisited: number;
  statesVisited: number;
  citiesVisited: number;
  transportationCounts: Record<string, number>;
  accommodationCounts: Record<string, number>;
};

export default function TravelOverview({ stats }: { stats: TravelStats }) {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Your Travel Overview</h2>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Trips */}
        <StatCard
          icon={<Plane className="w-8 h-8" />}
          value={stats.totalTrips}
          label="Total Trips"
        />

        {/* Days Explored */}
        <StatCard
          icon={<Calendar className="w-8 h-8" />}
          value={stats.daysExplored}
          label="Days Explored"
        />

        {/* Photos Captured */}
        <StatCard
          icon={<Camera className="w-8 h-8" />}
          value={stats.photosCaptured}
          label="Photos Captured"
        />
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Countries Visited */}
        <StatCard
          icon={<Globe className="w-8 h-8" />}
          value={`${stats.countriesVisited}/197`}
          label="Countries Visited"
        />

        {/* States Visited */}
        <StatCard
          icon={<MapPin className="w-8 h-8" />}
          value={`${stats.statesVisited}/50`}
          label="States Visited (US)"
        />

        {/* Cities Visited */}
        <StatCard
          icon={<Building2 className="w-8 h-8" />}
          value={stats.citiesVisited}
          label="Cities Visited"
        />
      </div>

      {/* Transportation Type and Stays by Type - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Transportation Type */}
        <div className="card bg-[#2c3e50] text-white p-6">
          <h3 className="text-lg font-semibold mb-6">Transportation Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <TransportStat
              icon={<Plane className="w-5 h-5" />}
              count={stats.transportationCounts["Airplanes"] || 0}
              label="Airplanes"
            />
            <TransportStat
              icon={<Bus className="w-5 h-5" />}
              count={stats.transportationCounts["Bus"] || 0}
              label="Bus"
            />
            <TransportStat
              icon={<Car className="w-5 h-5" />}
              count={stats.transportationCounts["Car"] || 0}
              label="Car"
            />
            <TransportStat
              icon={<Ship className="w-5 h-5" />}
              count={stats.transportationCounts["Cruise"] || 0}
              label="Cruise"
            />
            <TransportStat
              icon={<CarTaxiFront className="w-5 h-5" />}
              count={stats.transportationCounts["Uber/Taxi"] || 0}
              label="Uber/Taxi"
            />
            <TransportStat
              icon={<Footprints className="w-5 h-5" />}
              count={stats.transportationCounts["Walk"] || 0}
              label="Walk"
            />
            <TransportStat
              icon={<Train className="w-5 h-5" />}
              count={stats.transportationCounts["Train"] || 0}
              label="Train"
            />
            <TransportStat
              icon={<Truck className="w-5 h-5" />}
              count={stats.transportationCounts["RV"] || 0}
              label="RV"
            />
          </div>
        </div>

        {/* Stays by Type */}
        <div className="card bg-[#2c3e50] text-white p-6">
          <h3 className="text-lg font-semibold mb-6">Stays by Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <AccommodationStat
              icon={<Home className="w-5 h-5" />}
              count={stats.accommodationCounts["Houses"] || 0}
              label="Houses"
            />
            <AccommodationStat
              icon={<Building2 className="w-5 h-5" />}
              count={stats.accommodationCounts["Condo"] || 0}
              label="Condo"
            />
            <AccommodationStat
              icon={<Ship className="w-5 h-5" />}
              count={stats.accommodationCounts["Cruise"] || 0}
              label="Cruise"
            />
            <AccommodationStat
              icon={<Hotel className="w-5 h-5" />}
              count={stats.accommodationCounts["Hotel"] || 0}
              label="Hotel"
            />
            <AccommodationStat
              icon={<Truck className="w-5 h-5" />}
              count={stats.accommodationCounts["RVs"] || 0}
              label="RVs"
            />
            <AccommodationStat
              icon={<MoreHorizontal className="w-5 h-5" />}
              count={stats.accommodationCounts["Other"] || 0}
              label="Other"
            />
            <AccommodationStat
              icon={<Hotel className="w-5 h-5" />}
              count={stats.accommodationCounts["Resort"] || 0}
              label="Resort"
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Note: Counts are cumulative and unique. Repeat visits to the same
        location don't increase totals.
      </div>
    </section>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-[#2c3e50] text-white p-6 flex flex-col items-center justify-center space-y-3">
      <div className="text-[#66bfcc]">{icon}</div>
      <div className="text-4xl font-bold text-white">{value}</div>
      <div className="text-sm text-white/90">{label}</div>
    </div>
  );
}

function TransportStat({
  icon,
  count,
  label,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  return (
    <div className="rounded-md bg-[#3d5266] p-4 pr-6 pt-6 pb-6 flex items-center gap-3 ">
      <div className="text-[#66bfcc] flex-shrink-0">
        {React.cloneElement(icon as React.ReactElement, {
          className: "w-10 h-10",
        })}
      </div>
      <div className="flex flex-col">
        <div className="text-3xl font-bold text-white leading-none">
          {count}
        </div>
        <div className="text-sm text-white/90 leading-tight mt-1">{label}</div>
      </div>
    </div>
  );
}

function AccommodationStat({
  icon,
  count,
  label,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  return (
    <div className="rounded-md bg-[#3d5266] p-4 pr-6 pt-6 pb-6 flex items-center gap-3 ">
      <div className="text-[#66bfcc] flex-shrink-0">
        {React.cloneElement(icon as React.ReactElement, {
          className: "w-10 h-10",
        })}
      </div>
      <div className="flex flex-col">
        <div className="text-3xl font-bold text-white leading-none">
          {count}
        </div>
        <div className="text-sm text-white/90 leading-tight mt-1">{label}</div>
      </div>
    </div>
  );
}
