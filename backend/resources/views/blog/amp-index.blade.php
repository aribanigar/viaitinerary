@extends('blog.amp-layout')

@section('title', $seoTitle)
@section('description', $seoDescription)
@section('canonical', route('blog.index'))

@section('content')
    <div class="blog-list">
        <h2>Latest articles</h2>

        @foreach ($posts as $post)
            <div class="post-item" style="margin-bottom: 30px; border-bottom: 1px solid #f0f0f0; padding-bottom: 20px;">
                <a href="{{ route('blog.show', $post->slug) }}?amp=1" style="text-decoration: none; color: inherit;">
                    @if ($post->featured_image_url)
                        <amp-img src="{{ $post->featured_image_url }}" width="400" height="225" layout="responsive"
                            alt="{{ $post->title }}">
                        </amp-img>
                    @endif
                    <h3 style="margin: 10px 0 5px 0;">{{ $post->title }}</h3>
                    <p style="font-size: 0.9em; color: #666;">{{ $post->excerpt }}</p>
                </a>
            </div>
        @endforeach

        <div class="pagination">
            {{ $posts->appends(['amp' => 1])->links() }}
        </div>
    </div>
@endsection
