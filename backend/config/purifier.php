<?php

return [
    'encoding'      => 'UTF-8',
    'finalize'      => true,
    'ignoreNonStrings' => false,
    'cachePath'     => storage_path('app/purifier'),
    'cacheFileMode' => 0755,
    'settings'      => [
        'default' => [
            'HTML.Doctype'             => 'HTML 4.01 Transitional',
            'HTML.Allowed'             => 'h1,h2,h3,h4,h5,h6,p,br,strong,em,u,a[href|title|target],ul,ol,li,blockquote,code,pre,img[src|alt|title|width|height],table,thead,tbody,tr,th,td,figure,figcaption,hr,span[class],div[class]',
            'HTML.AllowedAttributes'   => 'href,title,target,src,alt,width,height,class',
            'CSS.AllowedProperties'    => '',
            'Attr.AllowedFrameTargets' => ['_blank', '_self'],
            'AutoFormat.RemoveEmpty'   => true,
            'AutoFormat.AutoParagraph' => false,
            'AutoFormat.Linkify'       => false,
        ],
    ],
];
