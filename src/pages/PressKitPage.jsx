// src/pages/PressKitPage.jsx
//
// Phase 38 — Press kit / media resources.
// Phase 41h (2026-06-14) — UX revisions per founder UAT feedback:
//   - Removed Founder section (founder privacy: name not exposed publicly).
//   - Removed empty product-screenshot placeholders (sit-on-request only).
//   - Updated Factsheet "Founded" line to reflect real timeline (concept 2025,
//     CUVAN LLC formalized 2026).
//
// Voice rules: institutional. No founder voice/byline anywhere on this page.

import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Download, Mail, ArrowLeft, Image as ImageIcon } from 'lucide-react';

const PressKitPage = () => {
  const factSheet = [
    { label: 'Founded', value: 'Concept 2025; CUVAN LLC formed 2026 (Florida USA).' },
    { label: 'Soft launch', value: 'July 1, 2026 (Founding-500 cohort)' },
    { label: 'Hard launch', value: 'September 15, 2026 (public)' },
    { label: 'Headquarters', value: 'Florida, USA. EU + UK GDPR representatives via Prighter (Vienna / London).' },
    { label: 'Category', value: 'Marriage-intent matchmaking. Not a dating app.' },
    { label: 'Differentiator', value: 'Verified-only membership. Identity verification (Didit) gates every profile. No casual dating. No swipe culture.' },
    { label: 'Audience', value: 'Adults seeking serious, long-term marriage. Denomination-neutral.' },
    { label: 'Privacy posture', value: 'GDPR-aligned. ROPA, DPIA, TOMs, Incident Response Runbook all maintained. EU-residency processing chain. Annual external pentest.' },
    { label: 'Press contact', value: 'press@marryzen.com' },
  ];

  return (
    <main className="min-h-screen bg-[#FAF7F2] py-12 px-4">
      <Helmet>
        <title>Press & Media — Marryzen</title>
        <meta name="description" content="Press kit, logos, factsheet, and media contact for Marryzen — a marriage-intent matchmaking platform." />
        <link rel="canonical" href="https://www.marryzen.com/press" />
      </Helmet>

      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <Link to="/" className="inline-flex items-center text-[#706B67] hover:text-[#1F1F1F] text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Home
          </Link>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1F1F1F] tracking-tight mb-3">
            Press &amp; Media
          </h1>
          <p className="text-[#706B67] text-lg max-w-2xl">
            Resources for journalists, podcasters, and analysts writing about Marryzen.
          </p>
        </div>

        {/* About */}
        <section className="bg-white border border-[#E6DCD2] rounded-[14px] p-8 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-4">About Marryzen</h2>
          <p className="text-[#1F1F1F] leading-relaxed mb-4">
            Marryzen is a marriage-intent matchmaking platform built for people who want serious,
            long-term partnership &mdash; not casual dating. Every member is identity-verified before
            their profile becomes searchable. Matching is weighted by what people actually need to
            know about each other before meeting.
          </p>
          <p className="text-[#1F1F1F] leading-relaxed">
            Marryzen operates under GDPR-aligned controls (controller-of-record CUVAN LLC, EU + UK
            representatives appointed via Prighter), with public ROPA, DPIA, and TOMs documents
            available on request to regulators and qualified researchers.
          </p>
        </section>

        {/* Factsheet */}
        <section className="bg-white border border-[#E6DCD2] rounded-[14px] p-8 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-6">Factsheet</h2>
          <dl className="grid sm:grid-cols-[180px_1fr] gap-x-6 gap-y-4">
            {factSheet.map((row) => (
              <React.Fragment key={row.label}>
                <dt className="text-sm font-bold text-[#706B67] uppercase tracking-wider">{row.label}</dt>
                <dd className="text-[#1F1F1F] text-base leading-relaxed">{row.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </section>

        {/* Logos */}
        <section className="bg-white border border-[#E6DCD2] rounded-[14px] p-8 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Logos &amp; brand assets</h2>
          <p className="text-sm text-[#706B67] mb-6">
            The logo includes a stylistic period (&ldquo;Marryzen.&rdquo;) on visual surfaces only.
            In running copy, please write &ldquo;Marryzen&rdquo; without the period.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href="/favicon.svg"
              download
              className="flex items-center justify-between p-4 border border-[#E6DCD2] rounded-lg hover:bg-[#FAFAF7] transition-colors group"
            >
              <span className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-[#E6B450]" />
                <span>
                  <span className="block text-sm font-bold text-[#1F1F1F]">Favicon (SVG)</span>
                  <span className="block text-xs text-[#706B67]">Vector mark</span>
                </span>
              </span>
              <Download className="w-4 h-4 text-[#706B67] group-hover:text-[#1F1F1F]" />
            </a>

            <a
              href="/og-image.svg"
              download
              className="flex items-center justify-between p-4 border border-[#E6DCD2] rounded-lg hover:bg-[#FAFAF7] transition-colors group"
            >
              <span className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-[#E6B450]" />
                <span>
                  <span className="block text-sm font-bold text-[#1F1F1F]">Wordmark card (SVG)</span>
                  <span className="block text-xs text-[#706B67]">1200&times;630 vector</span>
                </span>
              </span>
              <Download className="w-4 h-4 text-[#706B67] group-hover:text-[#1F1F1F]" />
            </a>

            <a
              href="/og-image.png"
              download
              className="flex items-center justify-between p-4 border border-[#E6DCD2] rounded-lg hover:bg-[#FAFAF7] transition-colors group"
            >
              <span className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-[#E6B450]" />
                <span>
                  <span className="block text-sm font-bold text-[#1F1F1F]">Wordmark card (PNG)</span>
                  <span className="block text-xs text-[#706B67]">1200&times;630 raster</span>
                </span>
              </span>
              <Download className="w-4 h-4 text-[#706B67] group-hover:text-[#1F1F1F]" />
            </a>

            <a
              href="/og-image-square.png"
              download
              className="flex items-center justify-between p-4 border border-[#E6DCD2] rounded-lg hover:bg-[#FAFAF7] transition-colors group"
            >
              <span className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-[#E6B450]" />
                <span>
                  <span className="block text-sm font-bold text-[#1F1F1F]">Wordmark square (PNG)</span>
                  <span className="block text-xs text-[#706B67]">1200&times;1200 raster</span>
                </span>
              </span>
              <Download className="w-4 h-4 text-[#706B67] group-hover:text-[#1F1F1F]" />
            </a>
          </div>

          <div className="mt-6 grid sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DCD2]">
              <div className="text-xs font-bold text-[#706B67] uppercase mb-1">Primary</div>
              <div className="flex items-center gap-2 text-[#1F1F1F]">
                <span className="inline-block w-4 h-4 rounded bg-[#C85A72]"></span>
                #C85A72 Rose
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DCD2]">
              <div className="text-xs font-bold text-[#706B67] uppercase mb-1">Accent</div>
              <div className="flex items-center gap-2 text-[#1F1F1F]">
                <span className="inline-block w-4 h-4 rounded bg-[#E6B450]"></span>
                #E6B450 Gold
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DCD2]">
              <div className="text-xs font-bold text-[#706B67] uppercase mb-1">Background</div>
              <div className="flex items-center gap-2 text-[#1F1F1F]">
                <span className="inline-block w-4 h-4 rounded bg-[#FAF7F2] border border-[#E6DCD2]"></span>
                #FAF7F2 Cream
              </div>
            </div>
          </div>
        </section>

        {/* Product screenshots — Phase 41h: empty placeholder grid removed.
            Replaced with a single explainer paragraph; real screenshots can
            be sent on request, so press contacts who actually need them email
            press@. Avoids the awkwardness of empty greyboxes pre-launch. */}
        <section className="bg-white border border-[#E6DCD2] rounded-[14px] p-8 mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Product screenshots</h2>
          <p className="text-sm text-[#706B67] leading-relaxed">
            High-resolution product screenshots are available on request. Email{' '}
            <a href="mailto:press@marryzen.com" className="text-[#C85A72] hover:underline">press@marryzen.com</a>{' '}
            with the publication, deadline, and intended angle, and we&rsquo;ll send a curated
            set within 24 hours.
          </p>
        </section>

        {/* Contact */}
        <section className="bg-[#F9E7EB] border border-[#E6DCD2] rounded-[14px] p-8 text-center">
          <Mail className="w-10 h-10 text-[#C85A72] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1F1F1F] mb-2">Press contact</h2>
          <p className="text-[#1F1F1F] mb-4">
            For interviews, fact-checks, custom data, or comment requests:
          </p>
          <a
            href="mailto:press@marryzen.com"
            className="inline-block px-7 py-3 bg-[#1F1F1F] hover:bg-black text-white font-bold rounded-full transition-colors"
          >
            press@marryzen.com
          </a>
          <p className="text-xs text-[#706B67] mt-4">
            We aim to respond within one business day.
          </p>
        </section>

      </div>
    </main>
  );
};

export default PressKitPage;
