return {
  ["ttip"] = function(args, kwargs)
    local text = pandoc.utils.stringify(kwargs["text"] or args[1] or "")
    local title = pandoc.utils.stringify(kwargs["title"] or "")
    local placement = pandoc.utils.stringify(kwargs["placement"] or "")
    if placement == "" then placement = "top" end


    if quarto.doc.isFormat("html") then
      local attr = pandoc.Attr(
        "",
        { "quarto-xref", "tip" },
        {
          ["data-bs-toggle"] = "tooltip",
          ["data-bs-title"] = title,
          ["data-bs-placement"] = placement,
          ["tabindex"] = "0"
        }
      )
      return pandoc.Span({ pandoc.Str(text) }, attr)
    end

    return pandoc.Str(text)
  end
}
