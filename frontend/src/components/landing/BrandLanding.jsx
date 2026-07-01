import React from "react";

// ViaItinerary landing — built from the provided brand design (Minimalist
// Editorial). Structure/classes/animations are verbatim from code.html; copy is
// ViaItinerary's, and readability fixes were applied (dark overlays on hero/CTA
// images, a reliable interstitial image, and the light-section heading recolored).
const BRAND_HTML = `<main class="w-full">
<!-- Main Title Area -->
<section class="relative w-full overflow-hidden flex flex-col items-center justify-center pt-[20px] pb-[60px] px-[20px]">
<div class="relative w-full max-w-[1200px] mx-auto rounded-[20px] overflow-hidden flex items-center justify-center min-h-[600px] pt-32 pb-12"><div class="absolute top-10 left-0 right-0 flex justify-center z-20">
<div class="text-xl font-bold tracking-tight text-white">ViaItinerary</div>
</div>
<img alt="A serene mountain sunrise viewed from an airy, minimalist interior space." class="absolute inset-0 w-full h-full object-cover" src="https://plus.unsplash.com/premium_photo-1669541884772-49c30fdee42c?q=80&amp;w=1675&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D">
<div class="absolute inset-0 bg-black/45"></div>
<div class="relative z-10 w-full px-8 text-center py-12 mx-8 rounded-[20px] max-w-4xl">
<h1 class="text-4xl md:text-6xl font-light leading-tight tracking-tight mb-8 text-white">Craft Beautiful Itineraries,<br>Effortlessly</h1>
<a href="/signup" class="inline-block text-xs font-medium px-6 py-2.5 rounded-[100px] hover:bg-primary/90 transition-all duration-300 tracking-wide bg-white text-black">Get Started Today</a>
</div>
</div>
</section>
<!-- Parallax Hero Image -->
<!-- Intro Text -->
<section class="pt-8 px-[20px] pb-[80px]">
<div class="max-w-[1200px] mx-auto">
<div class="flex flex-col lg:flex-row gap-8">
<!-- Label Column (Matches width of icons/spacing below if needed, or just provides offset) -->
<div class="lg:w-2/5 flex items-start pt-3">
<span class="text-xs font-semibold text-secondary tracking-[0.2em] uppercase whitespace-nowrap">The Platform</span>
</div>
<!-- Heading Column (Aligned with the content/image start below) -->
<div class="lg:w-3/5">
<p class="text-primary leading-tight font-light tracking-tight text-[36px] font-sans">
                    ViaItinerary strips away the busywork — so you can build beautiful itineraries, quote clients in minutes, and close more trips.&nbsp;</p>
</div>
</div>
</div>
</section>
<!-- Logo Roll -->
<section class="w-full overflow-hidden mb-16 bg-surface pt-[80px]">
<div class="logo-track opacity-60">
<!-- Group 1 -->
<div class="flex items-center gap-32 pr-32">
<div class="text-xl text-primary font-bold tracking-tight">VOGUE</div>
<div class="text-xl text-primary tracking-widest font-light">MONOCLE</div>
<div class="text-xl text-primary italic font-medium">Kinfolk</div>
<div class="text-xl text-primary uppercase font-semibold">Cereal</div>
<div class="text-xl text-primary tracking-wide">MUSEUM</div>
</div>
<!-- Group 2 -->
<div class="flex items-center gap-32 pr-32">
<div class="text-xl text-primary font-bold tracking-tight">VOGUE</div>
<div class="text-xl text-primary tracking-widest font-light">MONOCLE</div>
<div class="text-xl text-primary italic font-medium">Kinfolk</div>
<div class="text-xl text-primary uppercase font-semibold">Cereal</div>
<div class="text-xl text-primary tracking-wide">MUSEUM</div>
</div>
</div>
</section>
<!-- Smart Insights Section (Replicated & Adjusted) -->
<section class="pt-32 pb-12 px-[20px]">
<div class="max-w-[1200px] mx-auto">
<div class="max-w-full">
<span class="text-xs font-semibold text-secondary tracking-[0.2em] uppercase">Core Capabilities</span>
<h2 class="font-light mt-4 leading-tight text-[42px] text-primary">Everything you need to<br>run your travel business</h2>
</div>
</div>
</section><section class="pb-12 pt-8 px-[20px]">
<div class="max-w-[1200px] mx-auto">
<div class="border-outline-variant overflow-hidden flex flex-col lg:flex-row w-full min-h-[700px]">
<!-- Left Side: Visual/Card Interaction -->
<div class="w-full lg:w-2/5 flex flex-col lg:border-t-0 py-5 justify-between h-full">
<div class="max-w-md w-full h-full">
<div class="flex flex-col h-full">
<div>
<div class="flex items-center gap-3 mb-6">
<span class="material-symbols-outlined text-primary text-2xl">lightbulb</span>
<h2 class="font-light text-primary tracking-tight text-[42px]">Smart Insights</h2>
</div>
<p class="text-secondary text-sm mb-10 leading-relaxed font-light">
            ViaItinerary surfaces the numbers that matter — costs, margins, conversions — and guides your next move from quote to confirmed booking.
        </p>
</div>
<!-- Interactive Reveal List pushed to bottom -->
<div class="space-y-2 mt-auto">
<!-- Item 1 -->
<div class="group cursor-pointer">
<div class="border-t border-outline-variant pt-6 pb-4 relative overflow-hidden">
<div class="absolute top-0 left-0 h-[2px] bg-primary w-1/3 transition-all duration-500 group-hover:w-full"></div>
<h3 class="text-lg font-medium text-primary mb-2 transition-colors">Choose an objective</h3>
<div class="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-in-out">
<p class="text-sm text-secondary overflow-hidden leading-relaxed pr-4 font-light">
                        Select a focus area like theoretical foundations, empirical analysis, or historical context review.
                    </p>
</div>
</div>
</div>
<!-- Item 2 -->
<div class="group cursor-pointer">
<div class="border-t border-outline-variant pt-6 pb-4 relative overflow-hidden">
<div class="absolute top-0 left-0 h-[2px] bg-primary w-0 transition-all duration-500 group-hover:w-full"></div>
<h3 class="text-lg font-medium text-secondary group-hover:text-primary mb-2 transition-colors">Generate insights</h3>
<div class="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-in-out">
<p class="text-sm text-secondary overflow-hidden leading-relaxed pr-4 font-light">
                        Our system correlates data across multiple texts to provide you with unique perspectives and hidden linkages.
                    </p>
</div>
</div>
</div>
<!-- Item 3 -->
<div class="group cursor-pointer">
<div class="border-t border-outline-variant pt-6 pb-4 relative overflow-hidden">
<div class="absolute top-0 left-0 h-[2px] bg-primary w-0 transition-all duration-500 group-hover:w-full"></div>
<h3 class="text-lg font-medium text-secondary group-hover:text-primary mb-2 transition-colors">Validate at scale</h3>
<div class="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-in-out">
<p class="text-sm text-secondary overflow-hidden leading-relaxed pr-4 font-light">
                        Test your hypotheses against extensive academic databases to confirm the validity of your conclusions.
                    </p>
</div>
</div>
</div>
</div>
</div></div>
</div><div class="w-full lg:w-3/5 relative flex items-center justify-center overflow-hidden group p-5 self-stretch bg-transparent">
<!-- Background Image -->
<img alt="Atmospheric landscape" class="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 rounded-[20px]" src="https://images.unsplash.com/photo-1564107628966-daff03746bee?q=80&amp;w=987&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D">
<!-- Floating Interactive Card -->
<div class="relative z-10 w-full backdrop-blur-xl border border-outline-variant rounded-full overflow-hidden shadow-2xl transition-all duration-500 transform group-hover:-translate-y-1 bg-white/70 mx-4"><!-- Header -->
<div class="p-4 border-b border-primary/10 flex items-center justify-between bg-white/40">
<div class="flex items-center gap-4">
<div class="liquid-orb"></div>
<div class="flex gap-1.5">
<div class="w-2 h-2 rounded-full bg-primary/20"></div>
<div class="w-2 h-2 rounded-full bg-primary/20"></div>
</div>
</div>
<div class="text-[10px] uppercase tracking-widest text-primary/50 font-semibold">analytics_dashboard.io</div>
</div>
<!-- Dashboard Content -->
<div class="p-8 flex flex-col gap-8">
<!-- Top Metrics -->
<div class="grid grid-cols-3 gap-4">
<div class="space-y-1">
<div class="text-[10px] text-primary/50 uppercase tracking-wider">Retention</div>
<div class="text-xl font-light text-primary">94.2%</div>
<div class="h-1 w-full bg-primary/5 rounded-full overflow-hidden">
<div class="h-full bg-primary/40 w-[94%]"></div>
</div>
</div>
<div class="space-y-1">
<div class="text-[10px] text-primary/50 uppercase tracking-wider">Engagement</div>
<div class="text-xl font-light text-primary">+12.4%</div>
<div class="h-1 w-full bg-primary/5 rounded-full overflow-hidden">
<div class="h-full bg-primary/40 w-[65%]"></div>
</div>
</div>
<div class="space-y-1">
<div class="text-[10px] text-primary/50 uppercase tracking-wider">Focus Score</div>
<div class="text-xl font-light text-primary">8.8</div>
<div class="h-1 w-full bg-primary/5 rounded-full overflow-hidden">
<div class="h-full bg-primary/40 w-[88%]"></div>
</div>
</div>
</div>
<!-- Main Chart Area -->
<div class="relative h-48 w-full border-l border-b border-primary/10 flex items-end justify-between px-2 pb-2">
<div class="absolute inset-0 flex flex-col justify-between py-2">
<div class="w-full border-t border-primary/5"></div>
<div class="w-full border-t border-primary/5"></div>
<div class="w-full border-t border-primary/5"></div>
</div>
<div class="relative z-10 w-4 bg-primary/20 rounded-t-sm h-[40%]"></div>
<div class="relative z-10 w-4 bg-primary/40 rounded-t-sm h-[65%]"></div>
<div class="relative z-10 w-4 bg-primary/10 rounded-t-sm h-[30%]"></div>
<div class="relative z-10 w-4 bg-primary/60 rounded-t-sm h-[85%]"></div>
<div class="relative z-10 w-4 bg-primary/30 rounded-t-sm h-[50%]"></div>
<div class="relative z-10 w-4 bg-primary/50 rounded-t-sm h-[75%]"></div>
<div class="relative z-10 w-4 bg-primary/10 rounded-t-sm h-[20%]"></div>
<div class="relative z-10 w-4 bg-primary/40 rounded-t-sm h-[60%]"></div>
<div class="relative z-10 w-4 bg-primary/20 rounded-t-sm h-[45%]"></div>
</div>
<!-- Footer Info -->
<div class="flex justify-between items-center">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary/40 text-sm">schedule</span>
<span class="text-[10px] text-primary/50">Live updates enabled</span>
</div>
<div class="text-[10px] text-primary/60 font-mono tracking-tighter">0X-FF-4492-B</div>
</div>
</div></div>
</div>
<!-- Right Side: Dynamic List -->
</div>
</div>
</section>
<!-- Interstitial Section -->
<section class="pt-12 pb-12 px-[20px]">
<div class="max-w-[1200px] mx-auto">
<div class="relative w-full h-[400px] md:h-[500px] rounded-[20px] overflow-hidden flex items-center justify-center">
<img alt="A serene mountain landscape reflecting minimalist design principles." class="absolute inset-0 w-full h-full object-cover" src="https://images.unsplash.com/photo-1454496522488-7a8e488e8606?q=80&amp;w=1600&amp;auto=format&amp;fit=crop">
<div class="absolute inset-0 bg-black/40"></div>
<div class="relative z-10 w-full px-8 text-center flex flex-col items-center justify-center h-full max-w-3xl mx-auto rounded-[20px]">
<h2 class="text-3xl md:text-5xl font-light text-white leading-tight tracking-tight max-w-2xl mx-auto">Beautiful itineraries. Effortless workflow.</h2>
</div>
</div>
</div>
</section>
<!-- Duplicated Smart Insights Section (Swapped Layout) -->
<section class="pt-12 pb-12 px-[20px]">
<div class="max-w-[1200px] mx-auto">
<div class="max-w-full">
<span class="text-xs font-semibold text-secondary tracking-[0.2em] uppercase">Core Capabilities</span>
<h2 class="font-light text-primary mt-4 leading-tight text-[42px]">Everything you need to<br>run your travel business</h2>
</div>
</div>
</section><section class="pb-12 pt-8 px-[20px]">
<div class="max-w-[1200px] mx-auto">
<div class="border-outline-variant overflow-hidden flex flex-col lg:flex-row w-full min-h-[700px]">
<!-- Left Side: Dynamic List (Swapped) -->
<div class="w-full lg:w-2/5 flex flex-col lg:border-b-0 justify-between h-full py-5">
<div class="max-w-md w-full h-full">
<div class="flex flex-col h-full">
<div>
<div class="flex items-center gap-3 mb-6">
<span class="material-symbols-outlined text-primary text-2xl">lightbulb</span>
<h2 class="font-light text-primary tracking-tight text-[42px]">Smart Insights</h2>
</div>
<p class="text-secondary text-sm mb-10 leading-relaxed font-light">
            ViaItinerary surfaces the numbers that matter — costs, margins, conversions — and guides your next move from quote to confirmed booking.
        </p>
</div>
<!-- Interactive Reveal List pushed to bottom -->
<div class="space-y-2 mt-auto">
<!-- Item 1 -->
<div class="group cursor-pointer">
<div class="border-t border-outline-variant pt-6 pb-4 relative overflow-hidden">
<div class="absolute top-0 left-0 h-[2px] bg-primary w-1/3 transition-all duration-500 group-hover:w-full"></div>
<h3 class="text-lg font-medium text-primary mb-2 transition-colors">Choose an objective</h3>
<div class="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-in-out">
<p class="text-sm text-secondary overflow-hidden leading-relaxed pr-4 font-light">
                        Select a focus area like theoretical foundations, empirical analysis, or historical context review.
                    </p>
</div>
</div>
</div>
<!-- Item 2 -->
<div class="group cursor-pointer">
<div class="border-t border-outline-variant pt-6 pb-4 relative overflow-hidden">
<div class="absolute top-0 left-0 h-[2px] bg-primary w-0 transition-all duration-500 group-hover:w-full"></div>
<h3 class="text-lg font-medium text-secondary group-hover:text-primary mb-2 transition-colors">Generate insights</h3>
<div class="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-in-out">
<p class="text-sm text-secondary overflow-hidden leading-relaxed pr-4 font-light">
                        Our system correlates data across multiple texts to provide you with unique perspectives and hidden linkages.
                    </p>
</div>
</div>
</div>
<!-- Item 3 -->
<div class="group cursor-pointer">
<div class="border-t border-outline-variant pt-6 pb-4 relative overflow-hidden">
<div class="absolute top-0 left-0 h-[2px] bg-primary w-0 transition-all duration-500 group-hover:w-full"></div>
<h3 class="text-lg font-medium text-secondary group-hover:text-primary mb-2 transition-colors">Validate at scale</h3>
<div class="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-in-out">
<p class="text-sm text-secondary overflow-hidden leading-relaxed pr-4 font-light">
                        Test your hypotheses against extensive academic databases to confirm the validity of your conclusions.
                    </p>
</div>
</div>
</div>
</div>
</div></div>
</div>
<!-- Right Side: Visual/Card Interaction (Swapped) -->
<div class="w-full lg:w-3/5 relative flex items-center justify-center overflow-hidden group p-5 self-stretch bg-transparent pr-8">
<!-- Background Image -->
<img alt="Atmospheric landscape" class="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 rounded-[20px]" src="https://plus.unsplash.com/premium_photo-1675368244448-b8cff9ffdb03?q=80&amp;w=3203&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D">
<!-- Floating Interactive Card -->
<div class="relative z-10 w-full backdrop-blur-xl border border-outline-variant rounded-full overflow-hidden shadow-2xl transition-all duration-500 transform group-hover:-translate-y-1 bg-white/70 mx-4"><!-- Header -->
<div class="p-4 border-b border-primary/10 flex items-center justify-between bg-white/40">
<div class="flex items-center gap-4">
<div class="liquid-orb"></div>
<div class="flex gap-1.5">
<div class="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
<div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
<div class="w-3 h-3 rounded-full bg-[#27c93f]"></div>
</div>
</div>
<div class="text-[10px] uppercase tracking-widest text-primary/50 font-semibold">insight_generator.js</div>
</div>
<!-- Code Content -->
<div class="p-8 font-mono text-sm leading-relaxed overflow-x-auto text-primary/80">
<div class="flex gap-4">
<div class="text-primary/30 select-none text-right w-4">1</div>
<div class=""><span class="text-[#a626a4]">async function</span> <span class="text-[#4078f2]">generateInsight</span>(context) {</div>
</div>
<div class="flex gap-4">
<div class="text-primary/30 select-none text-right w-4">2</div>
<div class="pl-4"><span class="text-[#a626a4]">const</span> patterns = <span class="text-[#a626a4]">await</span> AI.<span class="text-[#4078f2]">analyze</span>(context.data);</div>
</div>
<div class="flex gap-4">
<div class="text-primary/30 select-none text-right w-4">3</div>
<div class="pl-4"></div>
</div>
<div class="flex gap-4">
<div class="text-primary/30 select-none text-right w-4">4</div>
<div class="pl-4"><span class="text-[#a626a4]">return</span> patterns.<span class="text-[#4078f2]">map</span>(p =&gt; ({</div>
</div>
<div class="flex gap-4">
<div class="text-primary/30 select-none text-right w-4">5</div>
<div class="pl-8">title: p.concept,</div>
</div>
<div class="flex gap-4">
<div class="text-primary/30 select-none text-right w-4">6</div>
<div class="pl-8">confidence: <span class="text-[#986801]">0.98</span>,</div>
</div>
<div class="flex gap-4">
<div class="text-primary/30 select-none text-right w-4">7</div>
<div class="pl-8">relevance: <span class="text-[#50a14f]">'high'</span></div>
</div>
<div class="flex gap-4">
<div class="text-primary/30 select-none text-right w-4">8</div>
<div class="pl-4">}));</div>
</div>
<div class="flex gap-4">
<div class="text-primary/30 select-none text-right w-4">9</div>
<div class="">}</div>
</div>
</div></div>
</div>
</div>
</div>
</section>
<!-- Features Grid Section -->
<section class="pb-12 pt-8 px-[20px] pb-[80px]">
<div class="max-w-[1200px] mx-auto">
<div class="mb-16">
<span class="text-xs font-semibold text-secondary tracking-[0.2em] uppercase">Core Capabilities</span>
<h2 class="md:text-4xl font-light text-primary mt-4 leading-tight font-sans text-[42px]">Advanced tools for<br>modern agencies</h2>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-[80px]">
<div class="flex flex-col relative">
<div class="w-full border-t border-outline-variant"></div>
<span class="material-symbols-outlined text-primary text-2xl mt-6">map</span>
<h3 class="text-[20px] font-medium text-primary mb-3 pt-[100px] tracking-tight font-sans">Itinerary Builder</h3>
<p class="text-[16px] text-secondary font-light leading-relaxed font-sans">Day-by-day plans with live pricing, hotels, cabs and inclusions.</p>
</div>
<div class="flex flex-col relative">
<div class="w-full border-t border-outline-variant"></div>
<span class="material-symbols-outlined text-primary text-2xl mt-6">groups</span>
<h3 class="text-[20px] font-medium text-primary mb-3 pt-[100px] tracking-tight font-sans">Lead CRM</h3>
<p class="text-[16px] text-secondary font-light leading-relaxed font-sans">Capture website inquiries, assign them to your team, and convert to trips.</p>
</div>
<div class="flex flex-col relative">
<div class="w-full border-t border-outline-variant"></div>
<span class="material-symbols-outlined text-primary text-2xl mt-6">dashboard</span>
<h3 class="text-[20px] font-medium text-primary mb-3 pt-[100px] tracking-tight font-sans">Package Templates</h3>
<p class="text-[16px] text-secondary font-light leading-relaxed font-sans">Build once, reuse forever — quote clients in seconds.</p>
</div>
<div class="flex flex-col relative">
<div class="w-full border-t border-outline-variant"></div>
<span class="material-symbols-outlined text-primary text-2xl mt-6">receipt_long</span>
<h3 class="text-[20px] font-medium text-primary mb-3 pt-[100px] tracking-tight font-sans">PDF & Invoicing</h3>
<p class="text-[16px] text-secondary font-light leading-relaxed font-sans">Branded itineraries, vouchers and invoices, ready to send.</p>
</div>
</div>
</div>
</section>
<!-- Sign Off Section -->
<section class="bg-background pb-0 px-[20px]">
<div class="max-w-[1200px] mx-auto">
<div class="relative w-full h-[400px] md:h-[500px] rounded-[20px] overflow-hidden flex items-center justify-center">
<!-- Background Image with Overlay for Readability -->
<img alt="A serene mountain sunrise viewed from an airy, minimalist interior space." class="absolute inset-0 w-full h-full object-cover" src="https://plus.unsplash.com/premium_photo-1669541884772-49c30fdee42c?q=80&amp;w=1675&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D">
<div class="absolute inset-0 bg-black/45"></div>
<!-- Centered Content Over Image -->
<div class="relative z-10 flex flex-col items-center text-center px-8 py-12 rounded-[20px] mx-6">
<span class="text-xs font-semibold tracking-[0.2em] uppercase mb-6 text-white">Core Capabilities</span>
<h2 class="text-4xl md:text-5xl font-light leading-tight max-w-2xl text-white">Ready to elevate your<br>travel business?</h2>
<a href="/signup" class="inline-block bg-primary text-on-primary text-xs font-medium px-6 py-2.5 rounded-[100px] hover:bg-primary/90 transition-all duration-300 tracking-wide mt-8">Start Free</a>
</div>
</div>
</div>
</section>
</main>
<!-- New Footer Section -->
<footer class="pt-2 pb-[20px] bg-background w-full mt-[10px] px-[20px]">
<div class="max-w-[1200px] mx-auto">
<div class="w-full h-[400px] md:h-[500px] rounded-[20px] flex flex-col justify-between relative border bg-surface-container-low border-outline-variant p-[20px]">
<div class="max-w-md">
<h3 class="text-3xl md:text-4xl font-light text-primary mb-4">Travel, simplified.</h3>
<p class="text-secondary leading-relaxed font-light">
            Focus on what matters. ViaItinerary strips away the busywork so crafting and closing trips feels effortless.
        </p>
</div>
<div class="flex flex-col md:flex-row justify-between items-end w-full gap-8">
<div class="text-6xl md:text-[8rem] font-bold tracking-tighter text-primary/80 leading-none">ViaItinerary</div>
<div class="flex flex-col items-end gap-6 mb-2">
<div class="text-xs text-secondary font-light text-right">
                © 2026 ViaItinerary. Built with intention.
            </div>
</div>
</div>
</div>
</div>
</footer>`;

const BrandLanding = () => (
  <div
    className="bg-background text-on-background font-sans antialiased selection:bg-primary-container selection:text-on-primary"
    dangerouslySetInnerHTML={{ __html: BRAND_HTML }}
  />
);

export default BrandLanding;
