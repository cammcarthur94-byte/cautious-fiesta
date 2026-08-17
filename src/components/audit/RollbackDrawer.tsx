'use client';

import React, { useState } from 'react';
import { History, RotateCcw, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface RollbackDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  onRollbackSuccess: () => void;
}

export function RollbackDrawer({
  isOpen,
  onClose,
  productId,
  onRollbackSuccess,
}: RollbackDrawerProps) {
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRollback = async () => {
    setIsRollingBack(true);
    try {
      const res = await fetch('/api/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          shopDomain: 'demo-store.myshopify.com',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Successfully rolled back to previous description and schema.');
        setTimeout(() => {
          onRollbackSuccess();
          onClose();
        }, 1500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Revision History & Rollback</h3>
            <p className="text-xs text-gray-500">Restore prior description backup from metafields</p>
          </div>
        </div>

        {successMessage ? (
          <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Safe Rollback Guarantee</p>
                <p className="text-amber-700 mt-0.5">
                  Rolling back will restore the previous description and revert active JSON-LD and FAQ metafields in Shopify.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={isRollingBack}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRollingBack ? 'animate-spin' : ''}`} />
                {isRollingBack ? 'Restoring...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
