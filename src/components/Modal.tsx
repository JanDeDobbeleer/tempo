import type { FC } from 'react';

import type { CustomerForm, EntryForm, ModalProps } from '../types';

const Modal: FC<ModalProps> = ({
  modalTitle,
  saveLabel,
  isEntryModal,
  isCustomerModal,
  canDelete,
  form,
  projOpts,
  serviceOpts,
  custOptsForEntry,
  inputStyle,
  textareaStyle,
  labelStyle,
  btnPrimaryLg,
  onFormKind,
  onFormProject,
  onFormService,
  onFormEntryCustomer,
  onFormDate,
  onFormStart,
  onFormEnd,
  onFormComment,
  onFormName,
  onSave,
  onCancel,
  onDelete,
  stopOverlay,
  attachments,
  attachmentUploading,
  attachmentError,
  onAddAttachments,
}) => {
  // Safe casts: each isXModal flag guarantees which loose form shape is active.
  const entryForm = form as EntryForm;
  const customerForm = form as CustomerForm;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,22,28,0.38)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '24px',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '440px',
          maxWidth: '100%',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          padding: '26px',
        }}
        onClick={stopOverlay}
      >
        <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '20px' }}>
          {modalTitle}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isEntryModal && (
            <>
              <div>
                <label style={labelStyle}>Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    style={{
                      ...inputStyle,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: entryForm.kind === 'project' ? '#1a1c20' : '#fff',
                      color: entryForm.kind === 'project' ? '#fff' : '#1a1c20',
                      cursor: 'pointer',
                    }}
                    onClick={() => onFormKind('project')}
                  >
                    Project
                  </button>
                  <button
                    type="button"
                    style={{
                      ...inputStyle,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: entryForm.kind === 'service' ? '#1a1c20' : '#fff',
                      color: entryForm.kind === 'service' ? '#fff' : '#1a1c20',
                      cursor: 'pointer',
                    }}
                    onClick={() => onFormKind('service')}
                  >
                    Service
                  </button>
                </div>
              </div>

              <div>
                {entryForm.kind === 'project' ? (
                  <>
                    <label style={labelStyle}>Project</label>
                    <select style={inputStyle} value={entryForm.projectId} onChange={onFormProject}>
                      {projOpts.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={labelStyle}>Customer</label>
                      <select style={inputStyle} value={entryForm.customerId} onChange={onFormEntryCustomer}>
                        {custOptsForEntry.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Service</label>
                      <select style={inputStyle} value={entryForm.serviceId} onChange={onFormService}>
                        {serviceOpts.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" style={inputStyle} value={entryForm.date} onChange={onFormDate} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Start</label>
                  <input
                    type="time"
                    step="900"
                    style={inputStyle}
                    value={entryForm.start}
                    onChange={onFormStart}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>End</label>
                  <input type="time" step="900" style={inputStyle} value={entryForm.end} onChange={onFormEnd} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>What did you work on?</label>
                <textarea
                  rows={2}
                  style={textareaStyle}
                  placeholder="e.g. Homepage layout, client call…"
                  value={entryForm.comment}
                  onChange={onFormComment}
                />
              </div>

              <div>
                <label style={labelStyle}>Attachments</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '8px 10px',
                        border: '1px solid #e2e4e8',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={attachment.onDownload}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', color: '#1a1c20', flex: 1, padding: 0 }}
                      >
                        {attachment.label}
                      </button>
                      <button
                        type="button"
                        onClick={attachment.onDelete}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '12px', padding: 0 }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <input type="file" multiple onChange={onAddAttachments} disabled={attachmentUploading} />
                  {attachmentUploading && <div style={{ fontSize: '12px', color: '#9ca3af' }}>Uploading…</div>}
                  {attachmentError && <div style={{ fontSize: '12px', color: '#dc2626' }}>{attachmentError}</div>}
                </div>
              </div>
            </>
          )}

          {isCustomerModal && (
            <div>
              <label style={labelStyle}>Customer name</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="e.g. Northwind Studio"
                value={customerForm.name}
                onChange={onFormName}
              />
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '26px',
          }}
        >
          {canDelete ? (
            <button
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                color: '#dc2626',
                padding: '8px 4px',
              }}
              onClick={onDelete}
            >
              Delete
            </button>
          ) : (
            <span />
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              style={{
                height: '38px',
                padding: '0 16px',
                border: '1px solid #e2e4e8',
                background: '#fff',
                borderRadius: '9px',
                cursor: 'pointer',
                fontSize: '13.5px',
                fontWeight: 500,
                color: '#3a3f48',
              }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button style={btnPrimaryLg} onClick={onSave}>
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
