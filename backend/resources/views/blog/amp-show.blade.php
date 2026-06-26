@extends('blog.amp-layout')

@section('title', $post->meta_title ?: $post->title)
@section('description', $post->meta_description ?: $post->excerpt)
@section('canonical', route('blog.show', $post->slug))

@section('content')
    <article>
        <h1>{{ $post->title }}</h1>

        <p class="excerpt">{{ $post->excerpt }}</p>

        @if ($post->featured_image_url)
            <div class="featured-image">
                <amp-img src="{{ $post->featured_image_url }}" width="800" height="450" layout="responsive"
                    alt="{{ $post->title }}">
                </amp-img>
            </div>
        @endif

        <div class="content">
            {!! $post->content !!}
        </div>
    </article>
@endsection
