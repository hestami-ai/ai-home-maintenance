'use client';

import Image from "next/image";
import Navbar from '@/components/Navbar';

export default function Home() {
  return (
    <main className="min-h-screen bg-accent-light dark:bg-primary-dark transition-colors duration-200">
      <Navbar />
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/robot_website_concept(cleansed).png"
            alt="Robot Concept"
            fill
            className="object-cover object-center"
            priority
          />
        </div>
        
        {/* Content Overlay */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-2xl">
            <h1 className="text-4xl tracking-tight font-extrabold text-primary-dark dark:text-white sm:text-5xl md:text-6xl lg:text-6xl">
              <span className="block">AI Home Maintenance</span>
              <span className="block text-secondary-main">Concierge</span>
            </h1>
            <p className="mt-3 text-base text-primary-light dark:text-gray-300 sm:text-lg md:mt-5 md:text-xl">
              Your intelligent partner in home maintenance. Let AI help you keep your home in perfect condition.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a
                href="/login"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-dark dark:bg-primary-light hover:bg-primary-main dark:hover:bg-primary-main transition-colors duration-150"
              >
                Get Started
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-dark dark:text-white bg-accent-main dark:bg-accent-dark hover:bg-accent-dark dark:hover:bg-accent-main transition-colors duration-150"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
