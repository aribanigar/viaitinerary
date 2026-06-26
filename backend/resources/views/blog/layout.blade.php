<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <!-- Google Tag Manager -->
    <script>
        (function(w, d, s, l, i) {
            w[l] = w[l] || [];
            w[l].push({
                'gtm.start': new Date().getTime(),
                event: 'gtm.js'
            });
            var f = d.getElementsByTagName(s)[0],
                j = d.createElement(s),
                dl = l != 'dataLayer' ? '&l=' + l : '';
            j.async = true;
            j.src =
                'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
            f.parentNode.insertBefore(j, f);
        })(window, document, 'script', 'dataLayer', 'GTM-PX3MS7GS');
    </script>
    <!-- End Google Tag Manager -->
    <script src="https://analytics.ahrefs.com/analytics.js" data-key="v+M1t0UIHkRMriaPSFladw" async></script>
    <script type="text/javascript">
        (function(c, l, a, r, i, t, y) {
            c[a] = c[a] || function() {
                (c[a].q = c[a].q || []).push(arguments)
            };
            t = l.createElement(r);
            t.async = 1;
            t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0];
            y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", "vxnkqsk6qq");
    </script>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-MMMDMVM860"></script>
    <script>
        window.dataLayer = window.dataLayer || [];

        function gtag() {
            dataLayer.push(arguments);
        }
        gtag('js', new Date());

        gtag('config', 'G-MMMDMVM860');
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $seoTitle ?? 'Blog' }}</title>

    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="{{ rtrim(config('app.asset_url'), '/') }}/favicon.png">
    <link rel="shortcut icon" type="image/x-icon" href="{{ rtrim(config('app.asset_url'), '/') }}/favicon.png">
    <link rel="apple-touch-icon" href="{{ rtrim(config('app.asset_url'), '/') }}/logo-light.png">

    <!-- SEO Meta Tags -->
    <meta name="description" content="{{ $seoDescription ?? '' }}">
    @if (!empty($seoKeywords))
        <meta name="keywords" content="{{ $seoKeywords }}">
    @endif
    <meta name="robots" content="index, follow">
    <meta name="publisher" content="ViaItinerary">
    <link rel="canonical" href="{{ $canonicalUrl ?? url()->current() }}">
    <link rel="amphtml" href="{{ url()->current() . (str_contains(url()->current(), '?') ? '&' : '?') . 'amp=1' }}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{{ url()->current() }}">
    <meta property="og:title" content="{{ $seoTitle ?? 'Blog' }}">
    <meta property="og:description" content="{{ $seoDescription ?? '' }}">
    @if (isset($ogImage))
        <meta property="og:image" content="{{ $ogImage }}">
    @endif

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $seoTitle ?? 'Blog' }}">
    <meta name="twitter:description" content="{{ $seoDescription ?? '' }}">
    @if (isset($ogImage))
        <meta name="twitter:image" content="{{ $ogImage }}">
    @endif

    @stack('schema-org')

    <!-- Styles -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .prose {
            max-width: 65ch;
        }

        .prose img {
            border-radius: 0.5rem;
            margin: 1.5rem 0;
        }

        .prose h1,
        .prose h2,
        .prose h3,
        .prose h4 {
            font-weight: 700;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }

        .prose h1 {
            font-size: 2.25rem;
        }

        .prose h2 {
            font-size: 1.875rem;
        }

        .prose h3 {
            font-size: 1.5rem;
        }

        .prose h4 {
            font-size: 1.25rem;
        }

        .prose p {
            margin-bottom: 1.25rem;
            line-height: 1.75;
        }

        .prose a {
            color: #2563eb;
            text-decoration: underline;
        }

        .prose ul,
        .prose ol {
            margin: 1.25rem 0;
            padding-left: 1.625rem;
        }

        .prose blockquote {
            border-left: 4px solid #e5e7eb;
            padding-left: 1rem;
            font-style: italic;
            color: #6b7280;
            margin: 1.5rem 0;
        }

        .prose code {
            background-color: #f3f4f6;
            padding: 0.2rem 0.4rem;
            border-radius: 0.25rem;
            font-size: 0.875em;
        }

        .prose pre {
            background-color: #1f2937;
            color: #f9fafb;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            margin: 1.5rem 0;
        }

        .prose pre code {
            background-color: transparent;
            padding: 0;
        }

        .prose table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
        }

        .prose th,
        .prose td {
            border: 1px solid #e5e7eb;
            padding: 0.75rem;
            text-align: left;
        }

        .prose th {
            background-color: #f3f4f6;
            font-weight: 600;
        }

        /* Utility Classes */
        .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .line-clamp-3 {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
        }

        ::-webkit-scrollbar-track {
            background: #f1f1f1;
        }

        ::-webkit-scrollbar-thumb {
            background: #043b36;
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #065f57;
        }

        /* Mobile Menu */
        .mobile-menu-overlay {
            position: fixed;
            inset: 0;
            background-color: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(8px);
            z-index: 55;
            display: none;
        }

        .mobile-menu-overlay.active {
            display: block;
        }

        .mobile-menu {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            width: 280px;
            background-color: white;
            z-index: 60;
            transform: translateX(100%);
            transition: transform 0.3s ease-in-out;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        .mobile-menu.active {
            transform: translateX(0);
        }
    </style>
    @stack('styles')
</head>

<body class="bg-gray-50 font-sans">
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PX3MS7GS" height="0" width="0"
            style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
    <!-- Navbar -->
    <nav class="fixed top-0 left-0 w-full z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-20 items-center">
                <!-- Logo - Fixed width for alignment -->
                <a href="/" class="flex items-center min-w-[140px]">
                    <img src="{{ rtrim(config('app.asset_url'), '/') }}/logo-light.png" alt="ViaItinerary"
                        class="h-32 w-auto object-contain block">
                </a>

                <!-- Desktop Nav - Centered -->
                <div class="hidden md:flex items-center flex-1 justify-center">
                    <div class="flex items-center gap-8">
                        <a href="/#features"
                            class="text-[15px] text-[#475569] hover:text-[#10182A] font-medium transition-colors">
                            Features
                        </a>
                        <a href="/solutions"
                            class="text-[15px] text-[#475569] hover:text-[#10182A] font-medium transition-colors">
                            Solutions
                        </a>
                        <a href="/subscription"
                            class="text-[15px] text-[#475569] hover:text-[#10182A] font-medium transition-colors">
                            Subscription
                        </a>
                        <a href="/blog"
                            class="text-[15px] text-[#475569] hover:text-[#10182A] font-medium transition-colors">
                            Blog
                        </a>
                        <a href="/trip-inquiry"
                            class="text-[15px] text-[#475569] hover:text-[#10182A] font-medium transition-colors">
                            Get My Travel Plan
                        </a>
                    </div>
                </div>

                <!-- Action Buttons - Fixed width for alignment -->
                <div class="hidden md:flex items-center gap-6 min-w-[200px] justify-end">
                    @auth
                        <a href="/dashboard"
                            class="bg-[#10182A] text-white px-7 py-3 rounded-xl text-[15px] font-bold hover:bg-slate-800 transition-all">
                            Dashboard
                        </a>
                    @else
                        <a href="/login"
                            class="text-[15px] font-medium text-[#475569] hover:text-[#10182A] transition-colors">
                            Log in
                        </a>
                        <a href="/signup"
                            class="bg-[#10182A] text-white px-7 py-3 rounded-xl text-[15px] font-bold hover:bg-slate-800 transition-all">
                            Try for free
                        </a>
                    @endauth
                </div>

                <!-- Mobile menu button -->
                <div class="md:hidden flex items-center">
                    <button onclick="toggleMobileMenu()"
                        class="text-[#10182A] hover:bg-slate-50 p-2 rounded-lg transition-colors focus:outline-none"
                        aria-label="Toggle menu">
                        <svg class="w-6 h-6 menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                        <svg class="w-6 h-6 close-icon hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Mobile Nav Overlay -->
    <div class="mobile-menu-overlay" onclick="toggleMobileMenu()"></div>

    <!-- Mobile Nav Drawer -->
    <div class="mobile-menu md:hidden">
        <div class="flex flex-col h-full p-6">
            <div class="flex justify-between items-center mb-10">
                <span class="text-xl font-black text-[#10182A]">Menu</span>
                <button onclick="toggleMobileMenu()" class="p-2 hover:bg-slate-50 rounded-lg transition-colors">
                    <svg class="w-6 h-6 text-[#10182A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M6 18L18 6M6 6l12 12">
                        </path>
                    </svg>
                </button>
            </div>

            <div class="flex flex-col gap-6">
                <a href="/#features"
                    class="text-[18px] text-[#475569] hover:text-[#10182A] font-semibold transition-colors">
                    Features
                </a>
                <a href="/solutions"
                    class="text-[18px] text-[#475569] hover:text-[#10182A] font-semibold transition-colors">
                    Solutions
                </a>
                <a href="/subscription"
                    class="text-[18px] text-[#475569] hover:text-[#10182A] font-semibold transition-colors">
                    Subscription
                </a>
                <a href="/blog"
                    class="text-[18px] text-[#475569] hover:text-[#10182A] font-semibold transition-colors">
                    Blog
                </a>
                <a href="/trip-inquiry"
                    class="text-[18px] text-[#475569] hover:text-[#10182A] font-semibold transition-colors">
                    Get My Travel Plan
                </a>
            </div>

            <div class="mt-auto pt-8 border-t border-slate-100 flex flex-col gap-4">
                @auth
                    <a href="/dashboard"
                        class="bg-[#10182A] text-white block text-center w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-slate-200">
                        Dashboard
                    </a>
                @else
                    <a href="/login" class="text-center py-3 text-[16px] font-bold text-[#475569]">
                        Log in
                    </a>
                    <a href="/signup"
                        class="bg-[#10182A] text-white block text-center w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-slate-200">
                        Try for free
                    </a>
                @endauth
            </div>
        </div>
    </div>

    <script>
        function toggleMobileMenu() {
            const overlay = document.querySelector('.mobile-menu-overlay');
            const menu = document.querySelector('.mobile-menu');
            const menuIcon = document.querySelector('.menu-icon');
            const closeIcon = document.querySelector('.close-icon');

            overlay.classList.toggle('active');
            menu.classList.toggle('active');
            menuIcon.classList.toggle('hidden');
            closeIcon.classList.toggle('hidden');
        }
    </script>

    <main class="pt-28 min-h-screen">
        @yield('content')
    </main>

    <!-- Footer -->
    <footer class="bg-[#043b36] pt-24 pb-12 text-white/90 font-sans">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
            <div class="flex flex-col lg:flex-row justify-between mb-24 gap-16 lg:gap-32">
                <!-- Logo & Description -->
                <div class="max-w-sm">
                    <div class="flex items-center">
                        <img src="{{ rtrim(config('app.asset_url'), '/') }}/logo-dark.png"
                            alt="ViaItinerary" class="h-32 w-auto object-contain block">
                    </div>
                    <p class="text-white/70 text-sm leading-relaxed mb-10 max-w-[320px]">
                        The preferred itinerary builder and CRM for forward-thinking
                        travel agencies and DMCs worldwide.
                    </p>
                    <div class="flex gap-4">
                        <a href="#" target="_blank"
                            rel="noopener noreferrer"
                            class="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-[#faa81e] flex items-center justify-center text-white/70 hover:text-[#043b36] transition-all group">
                            <svg class="w-5 h-5 transition-transform group-hover:scale-110" fill="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                        </a>
                        <a href="https://www.instagram.com/viaitinerary_official/" target="_blank"
                            rel="noopener noreferrer"
                            class="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-[#faa81e] flex items-center justify-center text-white/70 hover:text-[#043b36] transition-all group">
                            <svg class="w-5 h-5 transition-transform group-hover:scale-110" fill="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                        </a>
                        <a href="#" target="_blank"
                            rel="noopener noreferrer"
                            class="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-[#faa81e] flex items-center justify-center text-white/70 hover:text-[#043b36] transition-all group">
                            <svg class="w-5 h-5 transition-transform group-hover:scale-110" fill="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                        </a>
                        <a href="https://www.youtube.com/@ViaItinerary_official" target="_blank"
                            rel="noopener noreferrer"
                            class="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-[#faa81e] flex items-center justify-center text-white/70 hover:text-[#043b36] transition-all group">
                            <svg class="w-5 h-5 transition-transform group-hover:scale-110" fill="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                            </svg>
                        </a>
                    </div>
                </div>

                <!-- Links Sections -->
                <div class="flex flex-wrap gap-20 lg:gap-32">
                    <div class="min-w-[120px]">
                        <h4 class="text-[#faa81e] font-bold text-base mb-8 uppercase tracking-wider">
                            Support
                        </h4>
                        <ul class="space-y-6">
                            <li class="flex items-start gap-3">
                                <svg class="w-5 h-5 text-[#faa81e] shrink-0" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z">
                                    </path>
                                </svg>
                                <div class="text-white/70 text-sm">
                                    <p class="font-semibold text-white">Support Chat</p>
                                    <a href="mailto:contact@viaitinerary.com"
                                        class="hover:text-[#faa81e] transition-colors">
                                        contact@viaitinerary.com
                                    </a>
                                </div>
                            </li>
                            <li class="flex items-start gap-3">
                                <svg class="w-5 h-5 text-[#faa81e] shrink-0" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z">
                                    </path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                                <div class="text-white/70 text-sm">
                                    <p class="font-semibold text-white">Google Business</p>
                                    <a href="https://share.google/LdYs7a1YDfGvx1Nkc" target="_blank"
                                        rel="noopener noreferrer"
                                        class="hover:text-[#faa81e] transition-colors underline decoration-[#faa81e]/30 underline-offset-4">
                                        View Location
                                    </a>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div class="min-w-[120px]">
                        <h4 class="text-[#faa81e] font-bold text-base mb-8 uppercase tracking-wider">
                            Company
                        </h4>
                        <ul class="space-y-4">
                            <li>
                                <a href="/about-us"
                                    class="text-white/70 hover:text-[#faa81e] text-base transition-colors">
                                    About Us
                                </a>
                            </li>
                            <li>
                                <a href="/blog"
                                    class="text-white/70 hover:text-[#faa81e] text-base transition-colors">
                                    Blog
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Bottom Bar -->
            <div class="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                <p class="text-white/40 text-sm">
                    &copy; {{ date('Y') }} ViaItinerary. All rights reserved.
                </p>
                <div class="flex gap-8">
                    <a href="/refund-policy" class="text-white/40 hover:text-[#faa81e] text-sm transition-colors">
                        Refund Policy
                    </a>
                    <a href="/privacy-policy" class="text-white/40 hover:text-[#faa81e] text-sm transition-colors">
                        Privacy Policy
                    </a>
                    <a href="/terms-of-service" class="text-white/40 hover:text-[#faa81e] text-sm transition-colors">
                        Terms of Service
                    </a>
                </div>
            </div>
        </div>
    </footer>

    @stack('scripts')
</body>

</html>
