import React, { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput'
import type { AddressSuggestion } from '@/address/addressAutocomplete'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type DeliveryInfo = {
  recipientName: string
  phone: string
  city: string
  addressLine1: string
  postalCode?: string | null
}

type Props = {
  initialValue?: DeliveryInfo | null
  onClose: () => void
  onSave: (deliveryInfo: DeliveryInfo) => Promise<void>
}

type Errors = Partial<Record<keyof DeliveryInfo, string>>

const emptyDeliveryInfo: DeliveryInfo = {
  recipientName: '', phone: '', city: '', addressLine1: '', postalCode: '',
}

export const DeliveryInfoEditor: React.FC<Props> = ({ initialValue, onClose, onSave }) => {
  const [values, setValues] = useState<DeliveryInfo>(initialValue ?? emptyDeliveryInfo)
  const [errors, setErrors] = useState<Errors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const update = (field: keyof DeliveryInfo, value: string) => {
    setValues(previous => ({ ...previous, [field]: value }))
    if (errors[field]) setErrors(previous => ({ ...previous, [field]: undefined }))
  }

  const selectAddress = (suggestion: AddressSuggestion) => {
    setValues(previous => ({
      ...previous,
      addressLine1: suggestion.addressLine1 ?? suggestion.label,
      city: suggestion.city ?? previous.city,
      postalCode: suggestion.postalCode ?? previous.postalCode,
    }))
    setErrors(previous => ({ ...previous, addressLine1: undefined, city: undefined }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: Errors = {}
    if (!values.recipientName.trim()) nextErrors.recipientName = 'Введите имя получателя'
    if (!values.phone.trim()) nextErrors.phone = 'Введите телефон'
    if (!values.city.trim()) nextErrors.city = 'Введите город'
    if (!values.addressLine1.trim()) nextErrors.addressLine1 = 'Введите адрес'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setIsSaving(true)
    setSaveError('')
    try {
      await onSave({ ...values, postalCode: values.postalCode?.trim() || null })
      onClose()
    } catch {
      setSaveError('Не удалось сохранить данные доставки. Попробуйте ещё раз.')
      setIsSaving(false)
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="delivery-editor-title" className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h2 id="delivery-editor-title" className="text-xl font-semibold text-gray-900">Данные доставки</h2><p className="mt-1 text-sm text-gray-600">Изменения будут применены к этому заказу.</p></div>
        <Button type="button" variant="ghost" size="icon" aria-label="Закрыть" onClick={onClose} disabled={isSaving}><X className="h-5 w-5" /></Button>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <Field label="Получатель" error={errors.recipientName}><Input autoFocus value={values.recipientName} onChange={event => update('recipientName', event.target.value)} autoComplete="name" /></Field>
        <Field label="Телефон" error={errors.phone}><Input value={values.phone} onChange={event => update('phone', event.target.value)} autoComplete="tel" inputMode="tel" /></Field>
        <Field label="Город" error={errors.city}><Input value={values.city} onChange={event => update('city', event.target.value)} autoComplete="address-level2" /></Field>
        <Field label="Почтовый индекс"><Input value={values.postalCode ?? ''} onChange={event => update('postalCode', event.target.value)} autoComplete="postal-code" /></Field>
        <Field label="Улица, дом, квартира" error={errors.addressLine1} className="md:col-span-2"><AddressAutocompleteInput id="edit-delivery-address" value={values.addressLine1} onChange={value => update('addressLine1', value)} onSelect={selectAddress} /></Field>
        {saveError && <p role="alert" className="md:col-span-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
        <div className="mt-2 flex justify-end gap-3 md:col-span-2"><Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Отмена</Button><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isSaving ? 'Сохраняем…' : 'Сохранить'}</Button></div>
      </form>
    </div>
  </div>
}

const Field: React.FC<{ label: string; error?: string; className?: string; children: React.ReactNode }> = ({ label, error, className, children }) => <label className={`grid gap-1 text-sm font-medium text-gray-700 ${className ?? ''}`}><span>{label}</span>{children}{error && <span role="alert" className="text-sm font-normal text-red-600">{error}</span>}</label>
