import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';

import { Helmet } from 'react-helmet';
const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
      <Helmet><title>404 Not Found — Marryzen</title></Helmet>
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-pink-100 flex items-center justify-center mx-auto mb-6">
          <Heart className="w-10 h-10 text-[#C85A72]" />
        </div>
        <h1 className="text-3xl sm:text-4xl sm:text-5xl sm:text-6xl font-bold text-[#1F1F1F] mb-2 tracking-tight">404</h1>
        <p className="text-xl font-semibold text-[#1F1F1F] mb-2">Page not found</p>
        <p className="text-[#706B67] mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 py-3 bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to home
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
