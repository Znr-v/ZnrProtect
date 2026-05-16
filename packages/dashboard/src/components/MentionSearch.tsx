import React, { useState } from "react";
import { Search } from "lucide-react";

type MentionUser = {
  discordId: string;
  username: string;
  avatar?: string | null;
};

type MentionSearchProps = {
  users: MentionUser[];
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
};

export function MentionSearch({ users, value, onChange, onKeyDown, placeholder = "Rechercher (ou @)..." }: MentionSearchProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (val.includes("@") && val.indexOf("@") === val.lastIndexOf("@")) {
      setShowDropdown(true);
    } else if (!val.includes("@")) {
      setShowDropdown(false);
    }
  };

  const handleSelect = (username: string) => {
    onChange(username);
    setShowDropdown(false);
  };

  const atPos = value.indexOf("@");
  const searchAfterAt = atPos !== -1 ? value.slice(atPos + 1).toLowerCase() : "";
  const isDropdownVisible = value.includes("@") && showDropdown && users.length > 0;

  const displayedUsers = searchAfterAt
    ? users.filter((u) => (u.username || "").toLowerCase().includes(searchAfterAt)).slice(0, 8)
    : users.slice(0, 8);

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        className="w-full bg-theme-tertiary border border-theme-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:border-discord transition-colors"
      />
      {isDropdownVisible && (
        <div className="absolute top-full left-0 w-full mt-2 bg-theme-tertiary border border-theme-border rounded-xl shadow-lg z-50 overflow-hidden">
          {displayedUsers.length > 0 ? (
            displayedUsers.map((u) => (
              <button
                key={u.discordId}
                onClick={() => handleSelect(u.username)}
                className="w-full text-left px-4 py-3 hover:bg-theme-hover flex items-center gap-3 transition border-b border-theme-border/50 last:border-0"
              >
                {u.avatar ? (
                  <img src={u.avatar} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-theme-secondary flex items-center justify-center text-sm font-medium text-theme-primary">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-theme-primary">{u.username}</p>
                  <p className="text-xs text-theme-muted">{u.discordId}</p>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-theme-muted text-center">
              Aucun résultat
            </div>
          )}
        </div>
      )}
    </div>
  );
}
