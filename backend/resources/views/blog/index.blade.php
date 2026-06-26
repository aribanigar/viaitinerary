@extends('blog.layout')

@section('content')
    <!-- Hero Section -->
    <section class="bg-[#043b36] py-20 text-white relative overflow-hidden" style="margin-top: -7rem; padding-top: 10rem;">
        <div class="absolute top-0 right-0 w-1/3 h-full bg-[#faa81e]/10" style="transform: skewX(12deg) translateX(50%);">
        </div>
        <div class="max-w-7xl mx-auto px-4 relative z-10">
            @if ($currentCategory)
                <h1 class="text-4xl md:text-5xl font-bold mb-6">{{ $currentCategory->name }}</h1>
                @if ($currentCategory->description)
                    <p class="text-xl text-white/80 max-w-2xl">{{ $currentCategory->description }}</p>
                @endif
            @elseif ($currentTag)
                <h1 class="text-4xl md:text-5xl font-bold mb-6">#{{ $currentTag->name }}</h1>
                <p class="text-xl text-white/80 max-w-2xl">Browse articles tagged with {{ $currentTag->name }}</p>
            @else
                <h1 class="text-4xl md:text-5xl font-bold mb-6">Our Blog</h1>
                <p class="text-xl text-white/80 max-w-2xl">
                    Insights, tips, and updates for forward-thinking travel agencies and DMCs.
                </p>
            @endif
        </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 py-12">
        <!-- Filters -->
        <div class="flex flex-wrap gap-2 overflow-x-auto pb-2 mb-12">
            <a href="/blog"
                class="px-6 py-2 rounded-full text-sm font-medium transition-all {{ !$currentCategory && !$currentTag ? 'bg-[#043b36] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#043b36]' }}">
                All Posts
            </a>
            @foreach ($categories as $category)
                <a href="/blog/category/{{ $category->slug }}"
                    class="px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap {{ $currentCategory && $currentCategory->id == $category->id ? 'bg-[#043b36] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#043b36]' }}">
                    {{ $category->name }}
                </a>
            @endforeach
        </div>

        <!-- Posts Grid -->
        @if ($posts->isEmpty())
            <div class="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <h3 class="text-2xl font-bold text-gray-800 mb-2">No posts found</h3>
                <p class="text-gray-500">We couldn't find any articles matching your criteria.</p>
                @if ($currentCategory || $currentTag)
                    <a href="/blog" class="mt-6 inline-block text-[#043b36] font-bold hover:underline">
                        Clear all filters
                    </a>
                @endif
            </div>
        @else
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                @foreach ($posts as $post)
                    <a href="/blog/{{ $post->slug }}"
                        class="group bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
                        <div class="relative aspect-[16/10] overflow-hidden bg-gray-100">
                            @if ($post->featured_image_url)
                                <img src="{{ $post->featured_image_url }}" alt="{{ $post->title }}"
                                    class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                            @else
                                <div class="w-full h-full flex items-center justify-center text-gray-300">
                                    <svg class="w-12 h-12 opacity-20" fill="none" stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                    </svg>
                                </div>
                            @endif
                            @if ($post->category)
                                <span
                                    class="absolute top-4 left-4 bg-[#faa81e] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                                    {{ strtoupper($post->category->name) }}
                                </span>
                            @endif
                        </div>

                        <div class="p-8 flex-grow flex flex-col">
                            <div
                                class="flex items-center gap-4 text-xs text-gray-400 mb-4 font-medium uppercase tracking-wider">
                                <span class="flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
                                        </path>
                                    </svg>
                                    {{ $post->published_at->format('F d, Y') }}
                                </span>
                                <span class="flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
                                        </path>
                                    </svg>
                                    ViaItinerary
                                </span>
                            </div>

                            <h3
                                class="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#043b36] transition-colors line-clamp-2 leading-tight">
                                {{ $post->title }}
                            </h3>

                            <p class="text-gray-600 text-sm mb-6 line-clamp-3 leading-relaxed">
                                {{ $post->excerpt }}
                            </p>

                            <div class="mt-auto flex items-center text-[#043b36] font-bold text-sm tracking-wide">
                                READ ARTICLE
                                <svg class="w-4 h-4 ml-2 transition-transform group-hover:translate-x-2" fill="none"
                                    stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                                </svg>
                            </div>
                        </div>
                    </a>
                @endforeach
            </div>

            <!-- Pagination -->
            @if ($posts->hasPages())
                <div class="flex justify-center mt-20 gap-3">
                    {{ $posts->links() }}
                </div>
            @endif
        @endif
    </section>
@endsection
