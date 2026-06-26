<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AgencySetting extends Model
{
    use HasFactory;

    protected $guarded = ['id']; // Mass assignment protection.

    protected $hidden = [
        'smtp_app_password',
    ];

    protected $casts = [
        'smtp_app_password' => 'encrypted',
    ];

    protected $appends = ['logo_url', 'default_trip_image_url'];

    public function getLogoUrlAttribute()
    {
        if (!$this->logo_path) {
            return null;
        }

        if (str_starts_with($this->logo_path, 'http')) {
            return $this->logo_path;
        }

        return url('/api/storage/' . $this->logo_path);
    }

    public function getDefaultTripImageUrlAttribute()
    {
        if (!$this->default_trip_image_path) {
            return null;
        }

        if (str_starts_with($this->default_trip_image_path, 'http')) {
            return $this->default_trip_image_path;
        }

        return url('/api/storage/' . $this->default_trip_image_path);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function documentTemplate()
    {
        return $this->hasOne(AgencyDocumentTemplate::class, 'user_id', 'user_id');
    }

    private function resolveTemplateValue(string $key, $fallback)
    {
        if (!$this->relationLoaded('documentTemplate')) {
            $this->setRelation('documentTemplate', $this->documentTemplate()->first());
        }

        $template = $this->getRelation('documentTemplate');
        if ($template && !is_null($template->{$key})) {
            return $template->{$key};
        }

        return $fallback;
    }

    public function getConfirmationMessageAttribute($value)
    {
        return $this->resolveTemplateValue('confirmation_message', $value);
    }

    public function getConfirmationPdfMessageAttribute($value)
    {
        return $this->resolveTemplateValue('confirmation_pdf_message', $value);
    }

    public function getConfirmationHeroImageAttribute($value)
    {
        return $this->resolveTemplateValue('confirmation_hero_image', $value);
    }

    public function getPaymentVoucherEmailMessageAttribute($value)
    {
        return $this->resolveTemplateValue('payment_voucher_email_message', $value);
    }

    public function getInvoiceEmailMessageAttribute($value)
    {
        return $this->resolveTemplateValue('invoice_email_message', $value);
    }
}
