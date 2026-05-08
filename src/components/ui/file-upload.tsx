import { cn } from "@/lib/utils"
import React, { useRef, useState } from "react"
import { motion } from "motion/react"
import { IconUpload, IconX } from "@tabler/icons-react"
import { useDropzone } from "react-dropzone"
interface FileUploadProps {
  onChange?: (files: File[]) => void
  acceptTypes?: string[]      // e.g. [".csv", "application/pdf"]
  maxFiles?: number           // default handled in component
}
const mainVariant = {
  initial: {
    x: 0,
    y: 0,
  },
  animate: {
    x: 20,
    y: -20,
    opacity: 0.9,
  },
};
const secondaryVariant = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
};
export const FileUpload = ({
  onChange,
  acceptTypes,
  maxFiles = 1,
}: FileUploadProps) => {
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (newFiles: File[]) => {
    setFiles((prev) => {
      const combined = [...prev, ...newFiles].slice(0, maxFiles)
      onChange?.(combined)
      return combined
    })
  }

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      onChange?.(updated)
      return updated
    })
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const { getRootProps, isDragActive } = useDropzone({
    multiple: maxFiles > 1,
    maxFiles,
    accept: acceptTypes
      ? Object.fromEntries(acceptTypes.map((t) => [t, []]))
      : undefined,
    noClick: true,
    onDrop: handleFileChange,
  })

  const formatFileSize = (size: number) => {
    if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="w-full" {...getRootProps()}>
      <motion.div
        onClick={handleClick}
        whileHover="animate"
        className="p-10 group/file block rounded-lg cursor-pointer w-full relative overflow-hidden"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes?.join(",")}
          multiple={maxFiles > 1}
          onChange={(e) =>
            handleFileChange(Array.from(e.target.files ?? []))
          }
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center">
          <div className="relative w-full max-w-xl mx-auto">
            {files.map((file, idx) => (
              <motion.div
                key={file.name + idx}
                layout
                className="relative bg-white dark:bg-neutral-900 p-4 mt-4 rounded-md shadow-sm"
              >
                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(idx)
                  }}
                  className="absolute top-2 right-2 text-neutral-500 hover:text-red-500"
                >
                  <IconX size={16} />
                </button>

                <div className="flex justify-between items-center gap-4">
                  <p className="truncate text-neutral-700 dark:text-neutral-300">
                    {file.name}
                  </p>
                  <span className="text-sm px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800">
                    {formatFileSize(file.size)}
                  </span>
                </div>

                <div className="flex justify-between mt-2 text-sm text-neutral-500">
                  <span className="px-1 py-0.5 rounded bg-gray-100 dark:bg-neutral-800">
                    {file.type || "unknown"}
                  </span>
                  <span>
                    modified{" "}
                    {new Date(file.lastModified).toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            ))}

              {!files.length && (
              <motion.div
                layoutId="file-upload"
                variants={mainVariant}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
                className={cn(
                  "relative group-hover/file:shadow-2xl z-40 bg-white dark:bg-neutral-900 flex items-center justify-center h-32 mt-4 w-full max-w-[8rem] mx-auto rounded-md",
                  "shadow-[0px_10px_50px_rgba(0,0,0,0.1)]"
                )}
              >
                {isDragActive ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-neutral-600 flex flex-col items-center"
                  >
                    Drop it
                    <IconUpload className="h-6 w-6 text-neutral-600 dark:text-neutral-400" />
                  </motion.p>
                ) : (
                  <IconUpload className="h-6 w-6 text-neutral-600 dark:text-neutral-300" />
                )}
              </motion.div>
            )}
            {!files.length && (
              <motion.div
                variants={secondaryVariant}
                className="absolute opacity-0 border border-dashed border-green-400 inset-0 z-30 bg-transparent flex items-center justify-center h-32 mt-4 w-full max-w-[8rem] mx-auto rounded-md"
              ></motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
