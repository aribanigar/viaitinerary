@extends('blog.layout')

@push('schema-org')
    @php
        $schemaData = [
            '@context' => 'https://schema.org',
            '@type' => 'BlogPosting',
            'headline' => $post->meta_title ?: $post->title,
            'description' => $post->meta_description ?: $post->excerpt,
            'datePublished' => $post->published_at->toIso8601String(),
            'dateModified' => $post->updated_at->toIso8601String(),
            'author' => [
                '@type' => 'Organization',
                'name' => 'ViaItinerary',
            ],
            'publisher' => [
                '@type' => 'Organization',
                'name' => 'ViaItinerary',
            ],
        ];

        if ($post->featured_image_url) {
            $schemaData['image'] = $post->featured_image_url;
        }
    @endphp

    <script type="application/ld+json">
        {!! json_encode($schemaData, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) !!}
    </script>
@endpush

@section('content')
    <!-- Hero Image -->
    <div class="max-w-5xl mx-auto px-4 mb-12">
        <div class="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
            <div class="relative aspect-[21/9] overflow-hidden bg-gray-50">
                @if ($post->featured_image_url)
                    <img src="{{ $post->featured_image_url }}" alt="{{ $post->title }}" class="w-full h-full object-cover">
                @endif
                @if ($post->category)
                    <span
                        class="absolute top-6 left-6 bg-[#faa81e] text-white text-xs font-bold px-5 py-2 rounded-full shadow-lg">
                        {{ strtoupper($post->category->name) }}
                    </span>
                @endif
            </div>
        </div>
    </div>

    <div class="max-w-3xl mx-auto px-4">
        <!-- Back Button -->
        <a href="/blog"
            class="inline-flex items-center gap-2 text-gray-500 hover:text-[#043b36] font-bold text-sm mb-10 transition-colors group">
            <svg class="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            BACK TO BLOG
        </a>

        <article>
            <!-- Header -->
            <header class="mb-12">
                <div class="flex flex-wrap items-center gap-6 text-sm text-gray-400 mb-8 font-medium">
                    <span class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-[#faa81e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
                            </path>
                        </svg>
                        {{ $post->published_at->format('F d, Y') }}
                    </span>
                    <span class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-[#faa81e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                        BY VIAITINERARY
                    </span>
                    <span class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-[#faa81e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        {{ $post->read_time_minutes }} MIN READ
                    </span>
                </div>

                <h1 class="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.1] mb-8">
                    {{ $post->title }}
                </h1>

                <!-- Share Buttons -->
                <div class="flex items-center justify-between py-8 border-y border-gray-100 mb-12">
                    <div class="flex gap-3">
                        <a href="https://www.facebook.com/sharer/sharer.php?u={{ urlencode(url()->current()) }}"
                            target="_blank"
                            class="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#1877F2] hover:border-[#1877F2] transition-all">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path
                                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                        </a>
                        <a href="https://twitter.com/intent/tweet?url={{ urlencode(url()->current()) }}&text={{ urlencode($post->title) }}"
                            target="_blank"
                            class="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#1DA1F2] hover:border-[#1DA1F2] transition-all">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path
                                    d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                            </svg>
                        </a>
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url={{ urlencode(url()->current()) }}"
                            target="_blank"
                            class="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#0077B5] hover:border-[#0077B5] transition-all">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path
                                    d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                        </a>
                    </div>
                    <button onclick="shareArticle()"
                        class="flex items-center gap-2 bg-[#043b36] text-white px-6 py-2.5 rounded-full font-bold text-sm hover:shadow-lg transition-all">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z">
                            </path>
                        </svg>
                        SHARE ARTICLE
                    </button>
                </div>

                <script>
                    function shareArticle() {
                        const url = window.location.href;
                        const title = "{{ addslashes($post->title) }}";
                        const text = "{{ addslashes($post->excerpt) }}";

                        if (navigator.share) {
                            navigator.share({
                                title: title,
                                text: text,
                                url: url
                            }).catch((error) => {
                                // Fallback if share is cancelled
                                console.log('Share cancelled', error);
                            });
                        } else {
                            // Fallback: copy to clipboard
                            navigator.clipboard.writeText(url).then(() => {
                                alert('Link copied to clipboard!');
                            }).catch(() => {
                                // Final fallback: show url in prompt
                                prompt('Copy this link:', url);
                            });
                        }
                    }
                </script>
            </header>

            <!-- Content -->
            <div class="prose prose-lg max-w-none px-0 mb-12">
                {!! $post->content !!}
            </div>

            <!-- Tags -->
            @if ($post->tags->isNotEmpty())
                <div class="mt-16 pt-10 border-t border-gray-100">
                    <div class="flex flex-wrap gap-2">
                        @foreach ($post->tags as $tag)
                            <a href="/blog/tag/{{ $tag->slug }}"
                                class="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-bold px-4 py-2 rounded-full hover:bg-gray-200 transition-colors">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z">
                                    </path>
                                </svg>
                                {{ strtoupper($tag->name) }}
                            </a>
                        @endforeach
                    </div>
                </div>
            @endif
        </article>
    </div>

    <!-- Related Posts -->
    @if ($relatedPosts->isNotEmpty())
        <section class="bg-white py-24 mt-24">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex items-center justify-between mb-12">
                    <h2 class="text-3xl font-black text-gray-900">Recommended Reading</h2>
                    <a href="/blog" class="text-[#043b36] font-bold hover:underline">VIEW ALL POSTS</a>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    @foreach ($relatedPosts as $related)
                        <a href="/blog/{{ $related->slug }}" class="group">
                            <div class="aspect-[16/10] rounded-3xl overflow-hidden bg-gray-100 mb-6 shadow-sm">
                                @if ($related->featured_image_url)
                                    <img src="{{ $related->featured_image_url }}" alt="{{ $related->title }}"
                                        class="w-full h-full object-cover transition-transform group-hover:scale-105">
                                @else
                                    <div class="w-full h-full flex items-center justify-center text-gray-300">
                                        <svg class="w-12 h-12 opacity-10" fill="none" stroke="currentColor"
                                            viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253">
                                            </path>
                                        </svg>
                                    </div>
                                @endif
                            </div>
                            <h3
                                class="font-bold text-xl text-gray-900 group-hover:text-[#043b36] leading-snug line-clamp-2">
                                {{ $related->title }}
                            </h3>
                        </a>
                    @endforeach
                </div>
            </div>
        </section>
    @endif
@endsection
